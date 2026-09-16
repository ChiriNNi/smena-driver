import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, dateISO, num, ok, readBody, str, todayISO, uuid, withAdmin, withUser } from '@/lib/api-helpers';
import { toExpense, type ExpenseRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, car_id, driver_id, shift_id, date_iso::text AS date_iso, category, amount, comment';

// Расходы по автопарку.
//
// Часть приходит из смен: закрытая смена сама создаёт записи на свой расход по
// кассе и на штрафы (см. lib/shift-expenses.ts) — они помечены ссылкой на
// смену и по отдельности не удаляются. Остальное — топливо, мойка, ТО —
// администратор заводит руками.

export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const q = req.nextUrl.searchParams;
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Водитель видит только свои расходы — на случай, если позже они появятся
    // и в его кабинете.
    if (user.role !== 'admin') {
      params.push(user.id);
      conditions.push(`driver_id = $${params.length}`);
    } else {
      const carId = uuid(q.get('carId'), 'автомобиль');
      if (carId) {
        params.push(carId);
        conditions.push(`car_id = $${params.length}`);
      }
    }

    const from = q.get('from');
    const to = q.get('to');
    if (from) { params.push(from); conditions.push(`date_iso >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`date_iso <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<ExpenseRow>(
      `SELECT ${FIELDS} FROM expenses ${where} ORDER BY date_iso DESC, created_at DESC LIMIT 500`,
      params
    );
    return ok({ expenses: rows.map(toExpense) });
  });
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);
    const row = await queryOne<ExpenseRow>(
      `INSERT INTO expenses (car_id, driver_id, date_iso, category, amount, comment)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${FIELDS}`,
      [
        uuid(str(body, 'carId') || null, 'автомобиль', { required: true }),
        uuid(str(body, 'driverId') || null, 'водитель'),
        dateISO(body, 'date') || todayISO(),
        str(body, 'category', { required: true, max: 40 }),
        num(body, 'amount', { required: true, min: 0 }),
        str(body, 'comment', { max: 300 }),
      ]
    );
    if (!row) throw new ApiError('Не удалось добавить расход.', 500);
    return ok({ expense: toExpense(row) });
  });
}
