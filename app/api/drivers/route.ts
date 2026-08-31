import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type DriverRow = { id: string; name: string; created_at: string };

export async function GET() {
  const rows = await query<DriverRow>('SELECT id, name, created_at FROM drivers ORDER BY name ASC');
  return NextResponse.json({ drivers: rows });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const body = await req.json().catch(() => null);
  const name = String(body?.name || '').trim();
  if (!name) return jsonError('Укажите ФИО водителя.');
  const row = await queryOne<DriverRow>(
    'INSERT INTO drivers (name) VALUES ($1) RETURNING id, name, created_at',
    [name]
  );
  return NextResponse.json({ driver: row });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return jsonError('Не указан id.');
  await query('DELETE FROM drivers WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
