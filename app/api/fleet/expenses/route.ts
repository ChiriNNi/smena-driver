import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-helpers';
import { EXPENSE_CATS } from '@/lib/shared-calc';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await query(
    `SELECT e.*, d.name AS driver_name FROM expenses e LEFT JOIN drivers d ON d.id = e.driver_id ORDER BY e.date_iso DESC, e.created_at DESC`
  );
  return NextResponse.json({ expenses: rows });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const b = await req.json().catch(() => null);
  if (!b?.driverId || !b?.category || b.amount == null || !b.date) {
    return jsonError('Заполните все поля: водитель, категория, сумма, дата.');
  }
  if (!(EXPENSE_CATS as readonly string[]).includes(b.category)) return jsonError('Неизвестная категория.');
  const amount = Number(b.amount);
  if (!(amount > 0)) return jsonError('Сумма должна быть положительным числом.');
  const row = await queryOne(
    `INSERT INTO expenses (driver_id, category, amount, title, receipt_url, date_iso) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.driverId, b.category, amount, b.title || null, b.receiptUrl || null, b.date]
  );
  return NextResponse.json({ expense: row });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return jsonError('Не указан id.');
  await query('DELETE FROM expenses WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
