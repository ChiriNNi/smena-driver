import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, readBody, str, uuid, withAdmin } from '@/lib/api-helpers';
import { toCar, type CarRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'автомобиль', { required: true });
    const body = await readBody(req);

    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if ('model' in body) set('model', str(body, 'model', { required: true, max: 120 }));
    if ('plate' in body) set('plate', str(body, 'plate', { required: true, max: 20 }).toUpperCase().replace(/\s+/g, ''));
    if ('active' in body) set('active', Boolean(body.active));
    if (sets.length === 0) throw new ApiError('Нечего обновлять.');

    values.push(id);
    const row = await queryOne<CarRow>(
      `UPDATE cars SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id, model, plate, active`,
      values
    );
    if (!row) throw new ApiError('Автомобиль не найден.', 404);

    return ok({ car: toCar(row) });
  });
}

/**
 * Удаление автомобиля. Если на нём уже ездили, удалять нельзя — из истории
 * пропадёт машина смены; вместо этого автомобиль выводится из парка
 * флагом active и больше не предлагается при начале смены.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'автомобиль', { required: true });

    const used = await queryOne<{ n: string }>('SELECT count(*)::text AS n FROM shifts WHERE car_id = $1', [id]);
    if (Number(used?.n ?? 0) > 0) {
      throw new ApiError('По автомобилю есть смены — его можно только вывести из парка, чтобы не потерять историю.', 409);
    }

    await query('DELETE FROM cars WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
