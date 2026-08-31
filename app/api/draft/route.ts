import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// Черновик текущей (незавершённой) смены — чек-лист, заметки, данные смены.
// Без PIN: этим пользуется водитель на своём телефоне до нажатия "Завершить смену".

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driverId');
  if (!driverId) return jsonError('Не указан driverId.');
  const row = await queryOne<{ data: unknown }>('SELECT data FROM draft_shift WHERE driver_id = $1', [driverId]);
  return NextResponse.json({ data: row?.data ?? null });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const driverId = body?.driverId;
  if (!driverId) return jsonError('Не указан driverId.');
  await query(
    `INSERT INTO draft_shift (driver_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (driver_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [driverId, JSON.stringify(body.data ?? {})]
  );
  return NextResponse.json({ ok: true });
}
