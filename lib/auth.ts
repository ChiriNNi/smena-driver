import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';
import { toDriver, type Driver, type DriverRow, type Role } from './model';

// Сессии кабинета: вход по номеру телефона и PIN, роль лежит в подписанном
// токене. Отдельной таблицы сессий нет — токен самодостаточен (подпись HMAC
// + срок), так что выход из системы стоит одного удаления cookie.
//
// Срок жизни — 30 дней со скользящим продлением: пока водитель открывает
// приложение хотя бы раз в этот срок, PIN заново не спрашивается. Это прямо
// требование спецификации: смена начинается на морозе в перчатках, каждый день
// вводить PIN — плохой сценарий.

export const SESSION_COOKIE = 'smena_session';

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
// Продлеваем не на каждый запрос, а когда истрачена половина срока: иначе
// Set-Cookie улетал бы с каждым ответом без всякой пользы.
const RENEW_AFTER_MS = SESSION_TTL_MS / 2;

const BCRYPT_ROUNDS = 10;

export type SessionPayload = { sub: string; role: Role; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET не задан в переменных окружения (см. .env.example).');
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/** Токен вида base64url(payload).hmac — тот же принцип, что у JWT, без зависимости. */
export function createSessionToken(driverId: string, role: Role): string {
  const payload = b64url(JSON.stringify({ sub: driverId, role, exp: Date.now() + SESSION_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expected = sign(payload);
  if (expected.length !== sig.length) return null;
  // Сравнение постоянного времени: иначе по времени ответа можно подбирать подпись.
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload;
    if (!data.sub || (data.role !== 'driver' && data.role !== 'admin')) return null;
    if (!Number.isFinite(data.exp) || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
};

export async function setSessionCookie(driverId: string, role: Role): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(driverId, role), COOKIE_OPTIONS);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

const DRIVER_FIELDS =
  'id, last_name, first_name, phone_digits, role, active, car_id, hired_at::text AS hired_at';

/**
 * Текущий пользователь по cookie. Возвращает null, если токен отсутствует,
 * просрочен, подделан, либо аккаунт удалён или отключён администратором —
 * отключение действует сразу, не дожидаясь истечения токена.
 */
export async function getSessionUser(): Promise<Driver | null> {
  const store = await cookies();
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const row = await queryOne<DriverRow>(`SELECT ${DRIVER_FIELDS} FROM drivers WHERE id = $1`, [payload.sub]);
  if (!row || !row.active) return null;
  // Роль берём из БД, а не из токена: если администратора понизили до
  // водителя, старый токен не должен сохранять ему доступ к админке.
  return toDriver(row);
}

/**
 * Продлевает срок действия сессии, если истрачено больше половины.
 * Вызывается на «своём» эндпоинте /api/session — этого достаточно: клиент
 * обращается к нему при каждом запуске приложения.
 */
export async function slideSession(user: Driver): Promise<void> {
  const store = await cookies();
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return;
  const remaining = payload.exp - Date.now();
  if (remaining < SESSION_TTL_MS - RENEW_AFTER_MS) {
    store.set(SESSION_COOKIE, createSessionToken(user.id, user.role), COOKIE_OPTIONS);
  }
}

/* ─── PIN ────────────────────────────────────────────────────────────────── */

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export function comparePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Сколько неудачных попыток подряд допускается и на сколько минут после этого
 * закрывается вход. PIN из 4 цифр — это 10 000 вариантов: без такого предела
 * его перебирает скрипт за считаные минуты.
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type AuthResult =
  | { ok: true; user: Driver }
  | { ok: false; lockedMinutes: number }
  | { ok: false; lockedMinutes?: undefined };

/**
 * Проверка входа: номер телефона (нормализованный) + PIN.
 *
 * При неудаче не уточняет, что именно не подошло — по ответу нельзя узнать,
 * зарегистрирован ли номер. Исключение — блокировка: о ней сказать нужно,
 * иначе водитель будет считать, что забыл PIN, и звонить администратору.
 */
export async function authenticate(phoneDigits: string, pin: string): Promise<AuthResult> {
  const row = await queryOne<DriverRow & { pin_hash: string; failed_attempts: number; locked_until: string | null }>(
    `SELECT ${DRIVER_FIELDS}, pin_hash, failed_attempts, locked_until FROM drivers WHERE phone_digits = $1`,
    [phoneDigits]
  );
  if (!row || !row.active) return { ok: false };

  if (row.locked_until) {
    const left = new Date(row.locked_until).getTime() - Date.now();
    if (left > 0) return { ok: false, lockedMinutes: Math.max(1, Math.ceil(left / 60000)) };
  }

  if (await comparePin(pin, row.pin_hash)) {
    // Счётчик сбрасываем только если он не нулевой — лишний UPDATE на каждый
    // вход ни к чему.
    if (row.failed_attempts > 0 || row.locked_until) {
      await query('UPDATE drivers SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [row.id]);
    }
    return { ok: true, user: toDriver(row) };
  }

  const attempts = row.failed_attempts + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await query(
      `UPDATE drivers SET failed_attempts = 0, locked_until = now() + ($2 || ' minutes')::interval WHERE id = $1`,
      [row.id, String(LOCK_MINUTES)]
    );
    return { ok: false, lockedMinutes: LOCK_MINUTES };
  }

  await query('UPDATE drivers SET failed_attempts = $2 WHERE id = $1', [row.id, attempts]);
  return { ok: false };
}

export { SESSION_TTL_DAYS, MAX_FAILED_ATTEMPTS, LOCK_MINUTES };
