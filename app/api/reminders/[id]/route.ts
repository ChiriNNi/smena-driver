import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, dateISO, ok, readBody, str, uuid, withAdmin } from '@/lib/api-helpers';
import { toReminder, type ReminderRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, car_id, kind, due_date::text AS due_date, note';

type Params = { params: Promise<{ id: string }> };

/** Продление срока после пройденного ТО или продлённой страховки. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'напоминание', { required: true });
    const body = await readBody(req);

    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if ('carId' in body) set('car_id', uuid(str(body, 'carId') || null, 'автомобиль', { required: true }));
    if ('kind' in body) set('kind', str(body, 'kind', { required: true, max: 40 }));
    if ('dueDate' in body) set('due_date', dateISO(body, 'dueDate', { required: true }));
    if ('note' in body) set('note', str(body, 'note', { max: 300 }));
    if (sets.length === 0) throw new ApiError('Нечего обновлять.');

    values.push(id);
    const row = await queryOne<ReminderRow>(
      `UPDATE reminders SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${FIELDS}`,
      values
    );
    if (!row) throw new ApiError('Напоминание не найдено.', 404);
    return ok({ reminder: toReminder(row) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'напоминание', { required: true });
    await query('DELETE FROM reminders WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
