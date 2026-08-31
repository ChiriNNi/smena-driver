import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-helpers';
import { REMINDER_TYPES, reminderStatus } from '@/lib/shared-calc';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await query<{ id: string; due_date: string; [k: string]: unknown }>(
    `SELECT r.*, d.name AS driver_name FROM reminders r LEFT JOIN drivers d ON d.id = r.driver_id ORDER BY r.due_date ASC`
  );
  const withStatus = rows.map((r) => ({ ...r, status: reminderStatus(r.due_date) }));
  return NextResponse.json({ reminders: withStatus });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const b = await req.json().catch(() => null);
  if (!b?.type || !b?.dueDate) return jsonError('Заполните тип и срок.');
  if (!(REMINDER_TYPES as readonly string[]).includes(b.type)) return jsonError('Неизвестный тип напоминания.');
  const row = await queryOne(
    `INSERT INTO reminders (driver_id, type, due_date, note) VALUES ($1,$2,$3,$4) RETURNING *`,
    [b.driverId || null, b.type, b.dueDate, b.note || null]
  );
  return NextResponse.json({ reminder: row });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return jsonError('Не указан id.');
  await query('DELETE FROM reminders WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
