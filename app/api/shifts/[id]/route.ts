import { NextRequest } from 'next/server';
import { query, queryOne, withTransaction } from '@/lib/db';
import { ApiError, dateISO, num, ok, readBody, str, timeHHMM, uuid, withAdmin, withUser } from '@/lib/api-helpers';
import { cashBalance, driverLabel, toShift, type ShiftItem, type ShiftRemark, type ShiftRow } from '@/lib/model';
import { buildShiftSummary, money } from '@/lib/report-text';
import { syncShiftExpenses } from '@/lib/shift-expenses';
import { signPhotoUrls } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const SHIFT_FIELDS = `id, driver_id, car_id, driver_label, car_label, date_iso::text AS date_iso,
  time_start, time_end, place_start, place_end,
  cash_start, cash_end, cash_income, cash_income_note, cash_expenses, cash_expenses_note,
  cash_fines, odo_start, odo_end, checklist_done, checklist_total,
  edited_at::text AS edited_at, edited_by_label, summary_text`;

/** Как в POST: пробег за смену, при котором показания явно набраны с опечаткой. */
const MAX_SHIFT_KM = 2000;

type Params = { params: Promise<{ id: string }> };

type FullShiftRow = ShiftRow & { summary_text: string | null };

/** Замечания смены — нужны и для отчёта, и для пересбора текста сводки. */
async function loadRemarks(shiftId: string): Promise<ShiftRemark[]> {
  const rows = await query<{ item_text: string; comment: string | null; photos: number }>(
    `SELECT item_text, comment, coalesce(array_length(photo_paths, 1), 0) AS photos
     FROM shift_items
     WHERE shift_id = $1 AND (coalesce(comment, '') <> '' OR coalesce(array_length(photo_paths, 1), 0) > 0)
     ORDER BY position`,
    [shiftId]
  );
  return rows.map((r) => ({ text: r.item_text, comment: r.comment ?? '', photos: Number(r.photos) || 0 }));
}

// Подробный отчёт по одной смене: снимок чек-листа целиком, с замечаниями и
// временными ссылками на фото. Открывается по нажатию на смену в истории.
export async function GET(_req: NextRequest, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    uuid(id, 'смена', { required: true });

    const row = await queryOne<FullShiftRow>(`SELECT ${SHIFT_FIELDS} FROM shifts WHERE id = $1`, [id]);
    if (!row) throw new ApiError('Смена не найдена.', 404);
    // Водитель читает только свои смены.
    if (user.role !== 'admin' && row.driver_id !== user.id) throw new ApiError('Смена не найдена.', 404);

    const itemRows = await query<{
      id: string;
      phase: string;
      section_title: string;
      item_text: string;
      checked: boolean;
      comment: string | null;
      photo_paths: string[];
    }>(
      `SELECT id, phase, section_title, item_text, checked, comment, photo_paths
       FROM shift_items WHERE shift_id = $1 ORDER BY position`,
      [id]
    );

    const items: ShiftItem[] = await Promise.all(
      itemRows.map(async (i) => ({
        id: i.id,
        phase: i.phase,
        sectionTitle: i.section_title,
        text: i.item_text,
        checked: i.checked,
        comment: i.comment ?? '',
        photoUrls: await signPhotoUrls(i.photo_paths),
      }))
    );

    const remarks: ShiftRemark[] = itemRows
      .filter((i) => (i.comment ?? '') !== '' || i.photo_paths.length > 0)
      .map((i) => ({ text: i.item_text, comment: i.comment ?? '', photos: i.photo_paths.length }));

    return ok({ shift: toShift(row, remarks), items, summary: row.summary_text ?? '' });
  });
}

/**
 * Исправление сданной смены администратором.
 *
 * Водитель ошибается: перепутал цифры в кассе, списал расход не туда, снял
 * показания одометра не с того счётчика. Раньше исправить это было нельзя
 * вообще — только запросом в базу. Теперь можно, но смена помечается как
 * исправленная и видно, кто это сделал: для кассы это обязательное условие,
 * иначе правка ничем не отличается от подделки отчёта.
 *
 * Снимок чек-листа не меняется никогда — это то, что водитель отметил сам.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin(async (admin) => {
    const { id } = await params;
    uuid(id, 'смена', { required: true });

    const current = await queryOne<FullShiftRow>(`SELECT ${SHIFT_FIELDS} FROM shifts WHERE id = $1`, [id]);
    if (!current) throw new ApiError('Смена не найдена.', 404);

    const body = await readBody(req);
    /** Значение из запроса, а если поля нет — прежнее из смены. */
    const keepNum = (key: string, fallback: string | number) =>
      key in body ? num(body, key, { min: 0 }) : Number(fallback) || 0;
    const keepStr = (key: string, fallback: string, max: number) =>
      key in body ? str(body, key, { max }) : fallback;

    const next = {
      date: ('date' in body ? dateISO(body, 'date') : '') || current.date_iso,
      timeStart: 'timeStart' in body ? timeHHMM(body, 'timeStart') : current.time_start,
      timeEnd: 'timeEnd' in body ? timeHHMM(body, 'timeEnd') : current.time_end,
      placeStart: keepStr('placeStart', current.place_start, 200),
      placeEnd: keepStr('placeEnd', current.place_end, 200),
      cashStart: keepNum('cashStart', current.cash_start),
      cashIncome: keepNum('cashIncome', current.cash_income),
      cashIncomeNote: keepStr('cashIncomeNote', current.cash_income_note, 200),
      cashExpenses: keepNum('cashExpenses', current.cash_expenses),
      cashExpensesNote: keepStr('cashExpensesNote', current.cash_expenses_note, 200),
      cashFines: keepNum('cashFines', current.cash_fines),
      odoStart: keepNum('odoStart', current.odo_start),
      odoEnd: keepNum('odoEnd', current.odo_end),
    };

    const cashEnd = cashBalance(next);
    if (cashEnd < 0) {
      throw new ApiError(
        `Касса не сходится: ${money(next.cashStart)} и приход ${money(next.cashIncome)} ` +
          `не покрывают расход ${money(next.cashExpenses)} и штрафы ${money(next.cashFines)}.`
      );
    }
    if (next.odoEnd && next.odoEnd < next.odoStart) {
      throw new ApiError('Одометр на конец смены меньше, чем на начало — проверьте показания.');
    }
    if (next.odoEnd - next.odoStart > MAX_SHIFT_KM) {
      throw new ApiError(`Пробег за смену больше ${MAX_SHIFT_KM} км — проверьте показания одометра.`);
    }

    const remarks = await loadRemarks(id);
    const summary = buildShiftSummary({
      driverLabel: current.driver_label,
      carLabel: current.car_label,
      done: current.checklist_done,
      total: current.checklist_total,
      ...next,
      cashEnd,
      remarks,
    });

    const updated = await withTransaction(async (tx) => {
      const [row] = await tx.query<FullShiftRow>(
        `UPDATE shifts SET
           date_iso = $2, time_start = $3, time_end = $4, place_start = $5, place_end = $6,
           cash_start = $7, cash_income = $8, cash_income_note = $9,
           cash_expenses = $10, cash_expenses_note = $11, cash_fines = $12, cash_end = $13,
           odo_start = $14, odo_end = $15, summary_text = $16,
           edited_at = now(), edited_by_label = $17
         WHERE id = $1
         RETURNING ${SHIFT_FIELDS}`,
        [
          id,
          next.date,
          next.timeStart,
          next.timeEnd,
          next.placeStart,
          next.placeEnd,
          next.cashStart,
          next.cashIncome,
          next.cashIncomeNote,
          next.cashExpenses,
          next.cashExpensesNote,
          next.cashFines,
          cashEnd,
          next.odoStart,
          next.odoEnd,
          summary,
          driverLabel(admin),
        ]
      );

      // Расходы автопарка привязаны к смене — после правки они должны
      // показывать исправленные суммы, а не прежние.
      await syncShiftExpenses(tx, {
        id,
        carId: row.car_id,
        driverId: row.driver_id,
        date: next.date,
        cashExpenses: next.cashExpenses,
        cashExpensesNote: next.cashExpensesNote,
        cashFines: next.cashFines,
      });

      return row;
    });

    return ok({ shift: toShift(updated, remarks), summary });
  });
}
