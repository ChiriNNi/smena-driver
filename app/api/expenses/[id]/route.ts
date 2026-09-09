import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { ok, uuid, withAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Расход — обычная запись учёта, ничего на неё не ссылается, поэтому удаляется
// физически (в отличие от автомобилей и водителей).
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'расход', { required: true });
    await query('DELETE FROM expenses WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
