import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  checkPin,
  createSessionToken,
  getPinHash,
  isAdminSession,
  isValidPinFormat,
  setPin,
} from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [hasPin, isAdmin] = await Promise.all([getPinHash().then(Boolean), isAdminSession()]);
  return NextResponse.json({ hasPin, isAdmin });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== 'string') return jsonError('Некорректный запрос.');

  if (body.action === 'logout') {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'setup') {
    const pin = String(body.pin || '');
    if (await getPinHash()) return jsonError('PIN уже задан. Используйте вход.', 409);
    if (!isValidPinFormat(pin)) return jsonError('PIN должен содержать от 4 до 8 цифр.');
    await setPin(pin);
    const store = await cookies();
    store.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'login') {
    const pin = String(body.pin || '');
    const ok = await checkPin(pin);
    if (!ok) return jsonError('Неверный PIN.', 401);
    const store = await cookies();
    store.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return NextResponse.json({ ok: true });
  }

  return jsonError('Неизвестное действие.');
}
