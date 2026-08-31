// Единые формулы, использующиеся и на сервере (API/отчёты), и на клиенте (UI).
// В прежней версии (shift-checklist.html) эти формулы были продублированы
// по 4–6 раз в разных местах — здесь каждая существует ровно один раз.

/**
 * Расхождение кассы: факт на конец минус ожидаемый остаток (начало − расходы).
 * 0 — касса сходится, отрицательное — недостача, положительное — излишек.
 */
export function cashDiscrepancy(cashStart: number, cashEnd: number, cashExpenses: number): number {
  const s = Number(cashStart) || 0;
  const e = Number(cashEnd) || 0;
  const exp = Number(cashExpenses) || 0;
  return e - (s - exp);
}

/** Процент выполнения чек-листа: done/total, безопасно для total = 0. */
export function complianceOf(done: number, total: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

/** Форматирование суммы в тенге. */
export function fmtKzt(v: number): string {
  return (Number(v) || 0).toLocaleString('ru-RU') + ' ₸';
}

export const EXPENSE_CATS = ['Топливо', 'Мойка', 'Парковка', 'ТО / ремонт', 'Штраф', 'Покупки / поручения', 'Прочее'] as const;
export const REMINDER_TYPES = ['ТО', 'Страховка ОСАГО', 'Техосмотр', 'Права', 'Доверенность', 'Прочее'] as const;

export type ReminderStatus = 'ok' | 'soon' | 'over';

/** Статус срока: просрочено / скоро (<=14 дней) / в порядке. */
export function reminderStatus(dueDateISO: string, todayISO?: string): ReminderStatus {
  const today = todayISO ? new Date(todayISO) : new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateISO);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'over';
  if (diffDays <= 14) return 'soon';
  return 'ok';
}
