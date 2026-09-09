import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, num, ok, readBody, str, uuid, withAdmin } from '@/lib/api-helpers';
import { toRule, type RuleRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'правило', { required: true });
    const body = await readBody(req);

    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if ('title' in body) set('title', str(body, 'title', { required: true, max: 200 }));
    if ('body' in body) set('body', str(body, 'body', { max: 4000 }));
    if ('position' in body) set('position', num(body, 'position', { min: 0 }));
    if (sets.length === 0) throw new ApiError('Нечего обновлять.');

    values.push(id);
    const row = await queryOne<RuleRow>(
      `UPDATE rules SET ${sets.join(', ')} WHERE id = $${values.length} AND active RETURNING id, title, body`,
      values
    );
    if (!row) throw new ApiError('Правило не найдено.', 404);
    return ok({ rule: toRule(row) });
  });
}

/**
 * Удаление правила — флагом active. Журнал ознакомления ссылается на факт
 * прохождения теста, а не на конкретные пункты, но восстановить свод правил
 * на дату проверки должно быть возможно.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'правило', { required: true });
    await query('UPDATE rules SET active = false WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
