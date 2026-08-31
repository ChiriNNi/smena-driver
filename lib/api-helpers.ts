import { NextResponse } from 'next/server';
import { isAdminSession } from './auth';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Возвращает NextResponse с 403, если текущая сессия не в режиме администратора, иначе null. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const admin = await isAdminSession();
  if (!admin) return jsonError('Требуется режим администратора.', 403);
  return null;
}
