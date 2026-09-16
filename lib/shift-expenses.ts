import type { Queryable } from './db';

// Расходы смены в разделе «Автопарк → Расходы».
//
// Раньше эти два раздела не были связаны: водитель сдавал смену с расходом
// 40 000 и штрафом 5 000, а в расходах автопарка был ноль — администратор
// вбивал всё заново руками. Теперь закрытая смена сама создаёт записи, и они
// помечены ссылкой на смену: их нельзя удалить по отдельности, потому что
// первичный документ — смена, а не запись в расходах.

/** Категории, которые создаются из смены (в ручном выборе их нет). */
export const SHIFT_EXPENSE_CATEGORY = 'Расход смены';
export const SHIFT_FINE_CATEGORY = 'Штраф';

export type ShiftCashInput = {
  id: string;
  carId: string | null;
  driverId: string | null;
  date: string;
  cashExpenses: number;
  cashExpensesNote: string;
  cashFines: number;
};

/**
 * Приводит расходы, привязанные к смене, в соответствие с самой сменой.
 * Вызывается и при закрытии смены, и при её исправлении администратором —
 * поэтому сначала удаляет прежние записи этой смены, а потом пишет актуальные.
 */
export async function syncShiftExpenses(tx: Queryable, shift: ShiftCashInput): Promise<void> {
  await tx.query('DELETE FROM expenses WHERE shift_id = $1', [shift.id]);

  const rows: { category: string; amount: number; comment: string }[] = [];
  if (shift.cashExpenses > 0) {
    rows.push({
      category: SHIFT_EXPENSE_CATEGORY,
      amount: shift.cashExpenses,
      comment: shift.cashExpensesNote || 'Расход по кассе за смену',
    });
  }
  if (shift.cashFines > 0) {
    rows.push({ category: SHIFT_FINE_CATEGORY, amount: shift.cashFines, comment: 'Штрафы за смену' });
  }
  if (rows.length === 0) return;

  const values: unknown[] = [];
  const tuples = rows.map((r, i) => {
    values.push(shift.carId, shift.driverId, shift.id, shift.date, r.category, r.amount, r.comment);
    const base = i * 7;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  });

  await tx.query(
    `INSERT INTO expenses (car_id, driver_id, shift_id, date_iso, category, amount, comment)
     VALUES ${tuples.join(', ')}`,
    values
  );
}
