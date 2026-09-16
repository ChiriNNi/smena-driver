import { NextResponse } from 'next/server';
import { getSessionUser } from './auth';
import type { Driver } from './model';

// Общая обвязка маршрутов: проверка сессии, единый формат ошибок и разбор
// входящих данных. Цель — чтобы в самом маршруте оставалась только его
// собственная логика и SQL, без повторяющихся 20 строк проверок.

export function ok<T>(data: T): NextResponse {
  return NextResponse.json(data as Record<string, unknown>);
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Ошибка с осмысленным ответом клиенту: бросается из обработчиков. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type PgError = { code?: string; constraint?: string; message?: string };

/**
 * Превращает исключение в ответ. Нарушения ограничений БД разбираются
 * отдельно: пользователю нужно «такой номер уже занят», а не «ошибка 500».
 */
function toResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return jsonError(err.message, err.status);

  const e = err as PgError;
  if (e?.code === '23505') {
    if (e.constraint === 'drivers_phone_digits_key') return jsonError('Этот номер телефона уже зарегистрирован.', 409);
    if (e.constraint === 'cars_plate_key') return jsonError('Автомобиль с таким госномером уже есть.', 409);
    return jsonError('Такая запись уже существует.', 409);
  }
  if (e?.code === '23503') return jsonError('Ссылка на несуществующую запись.', 400);
  if (e?.code === '23514') return jsonError('Данные не прошли проверку формата.', 400);
  // 42P01 — таблицы ещё нет: типичная ситуация до применения схемы.
  if (e?.code === '42P01') return jsonError('База данных не инициализирована. Выполните npm run db:migrate.', 500);

  console.error('[api]', err);
  const message = e?.message?.includes('DATABASE_URL')
    ? 'База данных не настроена: укажите DATABASE_URL в переменных окружения.'
    : 'Внутренняя ошибка сервера.';
  return jsonError(message, 500);
}

/** Маршрут без обязательной авторизации (вход, выход). */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    return toResponse(err);
  }
}

/** Маршрут, доступный любому авторизованному пользователю. */
export async function withUser(fn: (user: Driver) => Promise<NextResponse>): Promise<NextResponse> {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) return jsonError('Требуется вход.', 401);
    return fn(user);
  });
}

/** Маршрут только для администратора. */
export async function withAdmin(fn: (admin: Driver) => Promise<NextResponse>): Promise<NextResponse> {
  return withUser(async (user) => {
    if (user.role !== 'admin') return jsonError('Доступно только администратору.', 403);
    return fn(user);
  });
}

/* ─── Разбор входящих данных ─────────────────────────────────────────────── */

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new ApiError('Некорректный запрос: ожидался JSON.');
  return body as Record<string, unknown>;
}

export function str(body: Record<string, unknown>, key: string, opts: { required?: boolean; max?: number } = {}): string {
  const raw = body[key];
  const value = raw === undefined || raw === null ? '' : String(raw).trim();
  if (opts.required && !value) throw new ApiError(`Не заполнено поле «${key}».`);
  if (opts.max && value.length > opts.max) throw new ApiError(`Поле «${key}» слишком длинное.`);
  return value;
}

export function num(body: Record<string, unknown>, key: string, opts: { required?: boolean; min?: number } = {}): number {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === '') {
    if (opts.required) throw new ApiError(`Не заполнено поле «${key}».`);
    return 0;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new ApiError(`Поле «${key}» должно быть числом.`);
  if (opts.min !== undefined && value < opts.min) throw new ApiError(`Поле «${key}» не может быть меньше ${opts.min}.`);
  return value;
}

export function bool(body: Record<string, unknown>, key: string, fallback = false): boolean {
  const raw = body[key];
  return raw === undefined ? fallback : Boolean(raw);
}

/** Дата в формате YYYY-MM-DD; пустая строка допустима, если не required. */
export function dateISO(body: Record<string, unknown>, key: string, opts: { required?: boolean } = {}): string {
  const value = str(body, key, { required: opts.required });
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(`Поле «${key}»: ожидается дата в формате ГГГГ-ММ-ДД.`);
  return value;
}

/** Время HH:MM; пустая строка допустима — водитель мог не заполнить. */
export function timeHHMM(body: Record<string, unknown>, key: string): string {
  const value = str(body, key);
  if (!value) return '';
  if (!/^\d{2}:\d{2}$/.test(value)) throw new ApiError(`Поле «${key}»: ожидается время в формате ЧЧ:ММ.`);
  return value;
}

export function oneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ApiError(`Поле «${field}»: недопустимое значение.`);
  }
  return value as T;
}

export function uuid(value: string | null | undefined, field: string, opts: { required?: boolean } = {}): string | null {
  if (!value) {
    if (opts.required) throw new ApiError(`Не указан ${field}.`);
    return null;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(`Некорректный ${field}.`);
  }
  return value;
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
