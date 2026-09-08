import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { queryOne, query } from './db';

export const SESSION_COOKIE = 'smena_admin_session';
// Сессия администратора живёт до конца дня работы — при перезагрузке страницы
// (в пределах TTL) PIN спрашивать заново не нужно, но не бессрочно.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 часов

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET не задан в переменных окружения.');
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Подписанный токен сессии: base64(exp).hmac — не JWT, но тот же принцип, без лишней зависимости. */
export function createSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  // сравнение постоянного времени
  if (expected.length !== sig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

/** Проверяет по cookie запроса, находится ли текущая сессия в режиме администратора. */
export async function isAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

const PIN_SETTING_KEY = 'admin_pin_hash';

export async function getPinHash(): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    [PIN_SETTING_KEY]
  );
  return row?.value ?? null;
}

export async function setPin(pin: string): Promise<void> {
  const hash = await bcrypt.hash(pin, 10);
  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [PIN_SETTING_KEY, hash]
  );
}

export async function checkPin(pin: string): Promise<boolean> {
  const hash = await getPinHash();
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}
