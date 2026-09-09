import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, dateISO, ok, readBody, str, uuid, withAdmin, withUser } from '@/lib/api-helpers';
import { toReminder, type ReminderRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, car_id, kind, due_date::text AS due_date, note';

// Напоминания по автомобилям: ТО, страховка, техосмотр. Просроченные и
// близкие сроки подсвечиваются в админке — сортировка по дате нужна там же.

export async function GET() {
  return withUser(async () => {
    const rows = await query<ReminderRow>(`SELECT ${FIELDS} FROM reminders ORDER BY due_date`);
    return ok({ reminders: rows.map(toReminder) });
  });
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);
    const row = await queryOne<ReminderRow>(
      `INSERT INTO reminders (car_id, kind, due_date, note) VALUES ($1, $2, $3, $4) RETURNING ${FIELDS}`,
      [
        uuid(str(body, 'carId') || null, 'автомобиль', { required: true }),
        str(body, 'kind', { required: true, max: 40 }),
        dateISO(body, 'dueDate', { required: true }),
        str(body, 'note', { max: 300 }),
      ]
    );
    if (!row) throw new ApiError('Не удалось создать напоминание.', 500);
    return ok({ reminder: toReminder(row) });
  });
}
