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
  | 'cashEnd'
  | 'cashExpenses'
  | 'cashFines'
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
    `Касса: начало ${money(s.cashStart)}, расходы ${money(s.cashExpenses)}, штрафы ${money(s.cashFines)}, итог ${money(s.cashEnd)}`,
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
