import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await query(
    `SELECT m.*, d.name AS driver_name FROM mileage m LEFT JOIN drivers d ON d.id = m.driver_id ORDER BY m.date_iso DESC, m.created_at DESC`
  );
  return NextResponse.json({ mileage: rows });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const b = await req.json().catch(() => null);
  if (!b?.driverId || !b?.car || b.odoStart == null || b.odoEnd == null || !b.date) {
    return jsonError('Заполните все поля: водитель, авто, одометр начало/конец, дата.');
  }
  const os = Number(b.odoStart), oe = Number(b.odoEnd);
  if (!(oe >= os)) return jsonError('Одометр на конец должен быть не меньше, чем на начало.');
  const row = await queryOne(
    `INSERT INTO mileage (driver_id, car, odo_start, odo_end, date_iso) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.driverId, b.car, os, oe, b.date]
  );
  return NextResponse.json({ mileage: row });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return jsonError('Не указан id.');
  await query('DELETE FROM mileage WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
