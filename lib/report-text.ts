// Текст отчёта по смене: он же уходит в WhatsApp, он же сохраняется в
// summary_text и попадает в выгрузку. Формируется в одном месте, чтобы
// сводка на экране водителя и сводка в архиве не разъезжались.

import type { Shift, ShiftRemark } from './model';

export function formatDateRu(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function money(v: number | string): string {
  return (Number(v) || 0).toLocaleString('ru-RU') + ' ₸';
}

/**
 * Склонение существительного по числу: «1 смена», «3 смены», «5 смен».
 * Нужно и в выгрузке, и на экранах — «Итого: 3 смен» читается как опечатка.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/** «3 смены» — число вместе со склонённым словом. */
export function shiftsCount(n: number): string {
  return `${n} ${plural(n, 'смена', 'смены', 'смен')}`;
}

export function km(v: number): string {
  return (Number(v) || 0).toLocaleString('ru-RU') + ' км';
}

export type ShiftSummaryInput = Pick<
  Shift,
  | 'driverLabel'
  | 'carLabel'
  | 'date'
  | 'timeStart'
  | 'timeEnd'
  | 'placeStart'
  | 'placeEnd'
  | 'done'
  | 'total'
  | 'cashStart'
  | 'cashIncome'
  | 'cashIncomeNote'
  | 'cashExpenses'
  | 'cashExpensesNote'
  | 'cashFines'
  | 'cashEnd'
  | 'odoStart'
  | 'odoEnd'
> & { remarks?: ShiftRemark[] };

export function buildShiftSummary(s: ShiftSummaryInput): string {
  const lines = [
    'Отчёт по смене — Smena',
    `Водитель: ${s.driverLabel}`,
    `Авто: ${s.carLabel}`,
    `Дата: ${formatDateRu(s.date)}, ${s.timeStart || '—'}–${s.timeEnd || '—'}`,
    `Маршрут: ${s.placeStart || '—'} → ${s.placeEnd || '—'}`,
    `Чек-лист: ${s.done}/${s.total} выполнено`,
    `Пробег: ${km(Math.max(0, s.odoEnd - s.odoStart))}`,
    // Касса разворачивается в столбик, как в бумажном журнале: остаток должен
    // читаться вместе со строками, из которых он получился.
    'Касса:',
    `  начало смены ${money(s.cashStart)}`,
    `  приход ${money(s.cashIncome)}${s.cashIncomeNote ? ` (${s.cashIncomeNote})` : ''}`,
    `  расход ${money(s.cashExpenses)}${s.cashExpensesNote ? ` (${s.cashExpensesNote})` : ''}`,
    `  штрафы ${money(s.cashFines)}`,
    `  остаток ${money(s.cashEnd)}`,
  ];

  const remarks = s.remarks ?? [];
  if (remarks.length > 0) {
    lines.push('Замечания:');
    for (const r of remarks) {
      lines.push(`— ${r.text}${r.comment ? `: ${r.comment}` : ''}${r.photos ? ` (фото: ${r.photos})` : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Ссылка на WhatsApp с готовым текстом.
 * Без номера открывается выбор чата (включая группы) — отправляет водитель
 * сам, одним нажатием. Статичной ссылки «сразу в эту группу с текстом»
 * в публичном API WhatsApp не существует, см. раздел 03 спецификации.
 */
export function whatsAppLink(text: string, targetDigits = ''): string {
  const base = targetDigits ? `https://wa.me/${targetDigits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
