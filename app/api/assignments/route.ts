import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, dateISO, ok, readBody, str, timeHHMM, uuid, withAdmin, withUser } from '@/lib/api-helpers';
import { toAssignment, type AssignmentRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, date_iso::text AS date_iso, driver_id, car_id, time_start, time_end';

// График смен: кто на какой машине и в какое время. Составляет администратор,
// водитель видит только свои будущие смены.

export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const q = req.nextUrl.searchParams;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (user.role !== 'admin') {
      params.push(user.id);
      conditions.push(`driver_id = $${params.length}`);
    }
    const from = q.get('from');
    const to = q.get('to');
    if (from) { params.push(from); conditions.push(`date_iso >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`date_iso <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<AssignmentRow>(
      `SELECT ${FIELDS} FROM assignments ${where} ORDER BY date_iso, time_start LIMIT 500`,
      params
    );
    return ok({ assignments: rows.map(toAssignment) });
  });
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);
    const date = dateISO(body, 'date', { required: true });
    const carId = uuid(str(body, 'carId') || null, 'автомобиль', { required: true })!;
    const driverId = uuid(str(body, 'driverId') || null, 'водитель', { required: true })!;

    // Одну машину нельзя выдать двум водителям на одну дату — в интерфейсе это
    // ещё и подсвечивается предупреждением, но решает всё равно сервер.
    const conflict = await queryOne<{ id: string }>(
      'SELECT id FROM assignments WHERE date_iso = $1 AND car_id = $2 LIMIT 1',
      [date, carId]
    );
    if (conflict) throw new ApiError('Этот автомобиль уже занят в графике на выбранную дату.', 409);

    const row = await queryOne<AssignmentRow>(
      `INSERT INTO assignments (date_iso, driver_id, car_id, time_start, time_end)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${FIELDS}`,
      [date, driverId, carId, timeHHMM(body, 'timeStart'), timeHHMM(body, 'timeEnd')]
    );
    if (!row) throw new ApiError('Не удалось добавить запись в график.', 500);
    return ok({ assignment: toAssignment(row) });
  });
}
