import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, num, ok, readBody, str, uuid, withAdmin } from '@/lib/api-helpers';
import { toRule, type RuleRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, kind, title, subtitle, body, points';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'блок регламента', { required: true });
    const body = await readBody(req);

    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown, cast = '') => {
      values.push(value);
      sets.push(`${column} = $${values.length}${cast}`);
    };

    if ('kind' in body) set('kind', str(body, 'kind') === 'duty' ? 'duty' : 'rule');
    if ('title' in body) set('title', str(body, 'title', { required: true, max: 200 }));
    if ('subtitle' in body) set('subtitle', str(body, 'subtitle', { max: 80 }));
    if ('body' in body) set('body', str(body, 'body', { max: 4000 }));
    if ('position' in body) set('position', num(body, 'position', { min: 0 }));

    if ('points' in body) {
      const points = Array.isArray(body.points) ? body.points.map((p) => String(p).trim()).filter(Boolean) : [];
      if (points.length === 0) throw new ApiError('Добавьте хотя бы один пункт.');
      set('points', points, '::text[]');
    }

    if (sets.length === 0) throw new ApiError('Нечего обновлять.');

    values.push(id);
    const row = await queryOne<RuleRow>(
      `UPDATE rules SET ${sets.join(', ')} WHERE id = $${values.length} AND active RETURNING ${FIELDS}`,
      values
    );
    if (!row) throw new ApiError('Блок регламента не найден.', 404);
    return ok({ rule: toRule(row) });
  });
}

/**
 * Удаление — флагом active. Ознакомление с регламентом подтверждается тестом,
 * и восстановить свод правил на дату проверки должно быть возможно.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'блок регламента', { required: true });
    await query('UPDATE rules SET active = false WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
