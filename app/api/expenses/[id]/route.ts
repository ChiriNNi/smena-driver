import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, uuid, withAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Расход, заведённый вручную, — обычная запись учёта, ничего на неё не
// ссылается, поэтому удаляется физически (в отличие от автомобилей и
// водителей).
//
// Расход из смены удалить нельзя: первичный документ — сама смена, и запись
// должна повторять её суммы. Исправляется он правкой смены, после которой
// расходы пересобираются.
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'расход', { required: true });

    const row = await queryOne<{ shift_id: string | null }>('SELECT shift_id FROM expenses WHERE id = $1', [id]);
    if (!row) throw new ApiError('Расход не найден.', 404);
    if (row.shift_id) {
      throw new ApiError('Этот расход пришёл из смены — исправьте саму смену, и он обновится.', 409);
    }

    await query('DELETE FROM expenses WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
