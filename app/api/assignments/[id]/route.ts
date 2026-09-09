import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { ok, uuid, withAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'запись графика', { required: true });
    await query('DELETE FROM assignments WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
