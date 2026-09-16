import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { ok, uuid, withUser } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// Начальные показания новой смены: остаток кассы и одометр с прошлой смены.
//
// В бумажном журнале «начало смены» — это всегда «остаток на конец» предыдущей
// строки, и водитель ничего не считает. В приложении он вбивал оба числа
// заново: опечатка в начале кассы ломала весь день, а по одометру появлялись
// разрывы, из-за которых пробег за месяц не сходился.
//
// Касса идёт от водителя (деньги у него), одометр — от машины (сколько бы
// водителей на ней ни менялось, счётчик один).
export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const carId = uuid(req.nextUrl.searchParams.get('carId'), 'автомобиль');

    const cash = await queryOne<{ cash_end: string; date_iso: string }>(
      `SELECT cash_end, date_iso::text AS date_iso FROM shifts
       WHERE driver_id = $1 ORDER BY date_iso DESC, created_at DESC LIMIT 1`,
      [user.id]
    );

    const odo = carId
      ? await queryOne<{ odo_end: string; date_iso: string; driver_label: string }>(
          `SELECT odo_end, date_iso::text AS date_iso, driver_label FROM shifts
           WHERE car_id = $1 AND odo_end > 0 ORDER BY date_iso DESC, created_at DESC LIMIT 1`,
          [carId]
        )
      : null;

    return ok({
      opening: {
        cash: cash ? Number(cash.cash_end) : null,
        cashDate: cash?.date_iso ?? null,
        odo: odo ? Number(odo.odo_end) : null,
        odoDate: odo?.date_iso ?? null,
      },
    });
  });
}
