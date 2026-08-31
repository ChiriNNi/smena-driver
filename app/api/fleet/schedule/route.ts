import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await query(
    `SELECT s.*, d.name AS driver_name FROM schedule s LEFT JOIN drivers d ON d.id = s.driver_id ORDER BY s.date_iso ASC, s.created_at ASC`
  );
  return NextResponse.json({ schedule: rows });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const b = await req.json().catch(() => null);
  if (!b?.driverId || !b?.date) return jsonError('Заполните водителя и дату.');
  const row = await queryOne(
    `INSERT INTO schedule (driver_id, date_iso, time_start, time_end, car, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.driverId, b.date, b.timeStart || null, b.timeEnd || null, b.car || null, b.note || null]
  );
  return NextResponse.json({ schedule: row });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return jsonError('Не указан id.');
  await query('DELETE FROM schedule WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
