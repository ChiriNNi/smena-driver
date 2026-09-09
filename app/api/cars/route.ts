import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, bool, ok, readBody, str, withAdmin, withUser } from '@/lib/api-helpers';
import { toCar, type CarRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

// Автопарк. Список нужен и водителю (выбор авто на смену), правки — только
// администратору.

export async function GET() {
  return withUser(async () => {
    const rows = await query<CarRow>('SELECT id, model, plate, active FROM cars ORDER BY active DESC, model, plate');
    return ok({ cars: rows.map(toCar) });
  });
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);
    const model = str(body, 'model', { required: true, max: 120 });
    // Госномер приводим к верхнему регистру без пробелов: «001 icg 01» и
    // «001ICG01» — один и тот же автомобиль, а уникальность в БД строгая.
    const plate = str(body, 'plate', { required: true, max: 20 }).toUpperCase().replace(/\s+/g, '');
    if (!plate) throw new ApiError('Укажите госномер.');

    const row = await queryOne<CarRow>(
      'INSERT INTO cars (model, plate, active) VALUES ($1, $2, $3) RETURNING id, model, plate, active',
      [model, plate, bool(body, 'active', true)]
    );
    if (!row) throw new ApiError('Не удалось добавить автомобиль.', 500);

    return ok({ car: toCar(row) });
  });
}
