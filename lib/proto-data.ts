// Демо-данные и типы для прототипа личного кабинета (app/proto).
// Ничего здесь не ходит в БД — всё живёт в памяти браузера, чтобы можно было
// смотреть и обсуждать поведение до того, как будет готова реальная схема.

import { CHECKLIST as REAL_CHECKLIST, type ChecklistPhase } from './checklist-data';
import { formatPhoneInput, onlyDigits, pinFromPhone } from './phone';
import { formatDateRu, km, money } from './report-text';

/* ─── Общие хелперы ──────────────────────────────────────────────────────── */

// Форматирование номера, даты и сумм живёт в lib/phone.ts и lib/report-text.ts —
// теми же функциями пользуется серверная часть, поэтому здесь только реэкспорт.
export { formatPhoneInput, onlyDigits, pinFromPhone, km, money };
export { formatDateRu as formatDate };

export function nowHHMM(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Разница в днях между сегодня и ISO-датой: отрицательная — просрочено. */
export function daysUntil(iso: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const target = new Date(iso).getTime();
  return Math.round((target - today) / 86400000);
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ─── Автомобили ─────────────────────────────────────────────────────────── */

export type ProtoCar = {
  id: string;
  model: string;
  plate: string;
  active: boolean;
};

export const SEED_CARS: ProtoCar[] = [
  { id: 'c1', model: 'Mercedes-Benz W223', plate: '001ICG01', active: true },
  { id: 'c2', model: 'Link&Co 09', plate: '001IC02', active: true },
  { id: 'c3', model: 'Toyota Camry 70', plate: '555ABC02', active: true },
];

export function carLabel(cars: ProtoCar[], carId: string): string {
  const car = cars.find((c) => c.id === carId);
  return car ? `${car.model} — ${car.plate}` : '—';
}

/* ─── Водители и администраторы ──────────────────────────────────────────── */

export type Role = 'driver' | 'admin';

export type ProtoDriver = {
  id: string;
  lastName: string;
  firstName: string;
  phone: string; // формат +7 701 234 56 78
  carId: string; // авто по умолчанию, у админа пустой
  pin: string; // последние 4 цифры телефона
  role: Role;
  active: boolean;
  hiredAt: string; // ISO
};

export const SEED_DRIVERS: ProtoDriver[] = [
  { id: 'd1', lastName: 'Ахметов', firstName: 'Данияр', phone: '+7 701 234 56 78', carId: 'c1', pin: '5678', role: 'driver', active: true, hiredAt: '2025-03-11' },
  { id: 'd2', lastName: 'Сергеева', firstName: 'Алия', phone: '+7 705 998 41 20', carId: 'c2', pin: '4120', role: 'driver', active: true, hiredAt: '2025-11-02' },
  { id: 'd3', lastName: 'Ержанов', firstName: 'Марат', phone: '+7 702 118 77 34', carId: 'c3', pin: '7734', role: 'driver', active: false, hiredAt: '2024-08-19' },
  { id: 'a1', lastName: 'Бекова', firstName: 'Гульмира', phone: '+7 707 555 90 11', carId: '', pin: '9011', role: 'admin', active: true, hiredAt: '2023-01-15' },
];

export function driverName(drivers: ProtoDriver[], driverId: string): string {
  const d = drivers.find((x) => x.id === driverId);
  return d ? `${d.lastName} ${d.firstName}` : '—';
}

export function initials(d: Pick<ProtoDriver, 'firstName' | 'lastName'>): string {
  return `${d.firstName[0] ?? ''}${d.lastName[0] ?? ''}`;
}

/* ─── Смены ──────────────────────────────────────────────────────────────── */

export type NoteEntry = { comment: string; photos: string[] }; // photos — object URL для превью

export type ShiftRemark = { text: string; comment?: string; photos?: number };

export type ProtoShift = {
  id: string;
  driverId: string;
  carId: string;
  date: string; // ISO
  timeStart: string;
  timeEnd: string;
  placeStart: string;
  placeEnd: string;
  done: number;
  total: number;
  cashStart: number;
  cashEnd: number;
  cashExpenses: number;
  cashFines: number;
  odoStart: number;
  odoEnd: number;
  remarks: ShiftRemark[];
};

export const SEED_SHIFTS: ProtoShift[] = [
  {
    id: 's1', driverId: 'd1', carId: 'c1', date: '2026-09-07', timeStart: '08:00', timeEnd: '20:00',
    placeStart: 'Офис, Алматы', placeEnd: 'Офис, Алматы', done: 42, total: 45,
    cashStart: 15000, cashEnd: 18500, cashExpenses: 3500, cashFines: 0,
    odoStart: 84210, odoEnd: 84515, remarks: [],
  },
  {
    id: 's2', driverId: 'd1', carId: 'c1', date: '2026-09-05', timeStart: '09:00', timeEnd: '21:30',
    placeStart: 'Офис, Алматы', placeEnd: 'Аэропорт', done: 45, total: 45,
    cashStart: 12000, cashEnd: 9000, cashExpenses: 8000, cashFines: 5000,
    odoStart: 83840, odoEnd: 84210,
    remarks: [{ text: 'Осмотр повреждений и царапин кузова', comment: 'Скол на переднем бампере справа', photos: 2 }],
  },
  {
    id: 's3', driverId: 'd2', carId: 'c2', date: '2026-09-06', timeStart: '08:15', timeEnd: '19:40',
    placeStart: 'Офис, Алматы', placeEnd: 'Офис, Алматы', done: 40, total: 45,
    cashStart: 20000, cashEnd: 24200, cashExpenses: 4800, cashFines: 0,
    odoStart: 41180, odoEnd: 41402,
    remarks: [
      { text: 'Детальная проверка пассажирской части', comment: 'Царапина на двери водителя', photos: 1 },
      { text: 'Зарядка Type-C', comment: 'Не хватает, забрал пассажир' },
    ],
  },
  {
    id: 's4', driverId: 'd2', carId: 'c2', date: '2026-09-04', timeStart: '08:00', timeEnd: '18:20',
    placeStart: 'Офис, Алматы', placeEnd: 'Офис, Алматы', done: 45, total: 45,
    cashStart: 10000, cashEnd: 14600, cashExpenses: 2400, cashFines: 0,
    odoStart: 40960, odoEnd: 41180, remarks: [],
  },
  {
    id: 's5', driverId: 'd3', carId: 'c3', date: '2026-09-03', timeStart: '10:00', timeEnd: '22:10',
    placeStart: 'Гараж', placeEnd: 'Гараж', done: 38, total: 45,
    cashStart: 8000, cashEnd: 7200, cashExpenses: 5800, cashFines: 15000,
    odoStart: 122400, odoEnd: 122735,
    remarks: [{ text: 'Проверка наличия штрафов в моменте', comment: 'Штраф за превышение, 15 000 ₸' }],
  },
  {
    id: 's6', driverId: 'd1', carId: 'c1', date: '2026-09-02', timeStart: '08:30', timeEnd: '20:45',
    placeStart: 'Офис, Алматы', placeEnd: 'Офис, Алматы', done: 44, total: 45,
    cashStart: 9000, cashEnd: 12800, cashExpenses: 3200, cashFines: 0,
    odoStart: 83520, odoEnd: 83840, remarks: [],
  },
];

/* ─── Автопарк: расходы, напоминания, график ─────────────────────────────── */

export const EXPENSE_CATEGORIES = ['Топливо', 'Мойка', 'ТО и ремонт', 'Штраф', 'Прочее'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ProtoExpense = {
  id: string;
  carId: string;
  driverId: string;
  date: string; // ISO
  category: ExpenseCategory;
  amount: number;
  comment: string;
};

export const SEED_EXPENSES: ProtoExpense[] = [
  { id: 'e1', carId: 'c1', driverId: 'd1', date: '2026-09-07', category: 'Топливо', amount: 22000, comment: 'АЗС Helios, 92' },
  { id: 'e2', carId: 'c1', driverId: 'd1', date: '2026-09-05', category: 'Мойка', amount: 4500, comment: 'Комплекс' },
  { id: 'e3', carId: 'c2', driverId: 'd2', date: '2026-09-06', category: 'Топливо', amount: 18500, comment: 'АЗС КазМунайГаз' },
  { id: 'e4', carId: 'c3', driverId: 'd3', date: '2026-09-03', category: 'Штраф', amount: 15000, comment: 'Превышение скорости' },
  { id: 'e5', carId: 'c1', driverId: 'd1', date: '2026-08-28', category: 'ТО и ремонт', amount: 145000, comment: 'ТО-3, замена масла и фильтров' },
];

export const REMINDER_KINDS = ['ТО', 'Страховка', 'Техосмотр'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export type ProtoReminder = {
  id: string;
  carId: string;
  kind: ReminderKind;
  dueDate: string; // ISO
  note: string;
};

export const SEED_REMINDERS: ProtoReminder[] = [
  { id: 'r1', carId: 'c1', kind: 'ТО', dueDate: '2026-09-20', note: 'ТО-4, пробег 90 000 км' },
  { id: 'r2', carId: 'c1', kind: 'Страховка', dueDate: '2026-11-14', note: 'Продление ОГПО' },
  { id: 'r3', carId: 'c2', kind: 'Техосмотр', dueDate: '2026-09-09', note: 'Плановый' },
  { id: 'r4', carId: 'c3', kind: 'Страховка', dueDate: '2026-08-30', note: 'Просрочена, срочно продлить' },
];

export type ProtoAssignment = {
  id: string;
  date: string; // ISO
  driverId: string;
  carId: string;
  timeStart: string;
  timeEnd: string;
};

export const SEED_ASSIGNMENTS: ProtoAssignment[] = [
  { id: 'g1', date: '2026-09-08', driverId: 'd1', carId: 'c1', timeStart: '08:00', timeEnd: '20:00' },
  { id: 'g2', date: '2026-09-08', driverId: 'd2', carId: 'c2', timeStart: '09:00', timeEnd: '21:00' },
  { id: 'g3', date: '2026-09-09', driverId: 'd1', carId: 'c1', timeStart: '08:00', timeEnd: '20:00' },
  { id: 'g4', date: '2026-09-10', driverId: 'd2', carId: 'c3', timeStart: '10:00', timeEnd: '22:00' },
];

/* ─── Правила и тест по ТБ ───────────────────────────────────────────────── */

export type ProtoRule = { id: string; title: string; body: string };

export const SEED_RULES: ProtoRule[] = [
  { id: 'ru1', title: 'Скоростной режим', body: 'В городе не превышать 60 км/ч, на трассе — установленный знаками лимит. Штрафы удерживаются с виновника.' },
  { id: 'ru2', title: 'Алкоголь и лекарства', body: 'Полный запрет. Приём лекарств, влияющих на реакцию, обязательно согласовывать с руководителем.' },
  { id: 'ru3', title: 'Телефон за рулём', body: 'Только громкая связь или гарнитура. Переписка и навигация — на остановке.' },
  { id: 'ru4', title: 'Действия при ДТП', body: 'Включить аварийку, выставить знак, вызвать 102, сообщить руководителю, сделать фото до перемещения авто.' },
];

export type QuizQuestion = { id: string; question: string; options: string[]; correct: number };

export const SEED_QUIZ: QuizQuestion[] = [
  { id: 'q1', question: 'Максимальная скорость в городе для служебного авто?', options: ['60 км/ч', '80 км/ч', 'По потоку'], correct: 0 },
  { id: 'q2', question: 'Что делать сразу после ДТП?', options: ['Отогнать авто на парковку', 'Включить аварийку и выставить знак', 'Уехать, если нет пострадавших'], correct: 1 },
  { id: 'q3', question: 'Можно ли пользоваться телефоном за рулём?', options: ['Да, если недолго', 'Только громкая связь или гарнитура', 'Да, на светофоре'], correct: 1 },
];

export type ProtoAck = { id: string; driverId: string; date: string; score: number; total: number };

export const SEED_ACKS: ProtoAck[] = [
  { id: 'ak1', driverId: 'd1', date: '2026-09-01', score: 3, total: 3 },
  { id: 'ak2', driverId: 'd2', date: '2026-08-15', score: 2, total: 3 },
];

/** Инструктаж действует 30 дней — потом водитель проходит его заново. */
export const BRIEFING_VALID_DAYS = 30;

export function latestAck(acks: ProtoAck[], driverId: string): ProtoAck | undefined {
  return acks.filter((a) => a.driverId === driverId).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

/**
 * Допуск к смене: тест сдан без ошибок и не позже 30 дней назад.
 * В проде такую проверку делает сервер — на клиенте она только для UX.
 */
export function isBriefingValid(acks: ProtoAck[], driverId: string): boolean {
  const ack = latestAck(acks, driverId);
  if (!ack || ack.score < ack.total) return false;
  return daysUntil(ack.date) > -BRIEFING_VALID_DAYS;
}

/* ─── Чек-лист ───────────────────────────────────────────────────────────── */

// Мутируемая копия реального чек-листа — редактор администратора в прототипе
// правит именно её, не трогая lib/checklist-data.ts.
export function cloneChecklist(): ChecklistPhase[] {
  return JSON.parse(JSON.stringify(REAL_CHECKLIST));
}

export function countChecklistItems(checklist: ChecklistPhase[]): number {
  return checklist.reduce((sum, ph) => sum + ph.sections.reduce((s, sec) => s + sec.items.length, 0), 0);
}

/* ─── Текстовые сводки и экспорт ─────────────────────────────────────────── */

export function buildShiftReportText(shift: ProtoShift, drivers: ProtoDriver[], cars: ProtoCar[]): string {
  const lines = [
    'Отчёт по смене — Smena',
    `Водитель: ${driverName(drivers, shift.driverId)}`,
    `Авто: ${carLabel(cars, shift.carId)}`,
    `Дата: ${formatDateRu(shift.date)}, ${shift.timeStart}–${shift.timeEnd}`,
    `Маршрут: ${shift.placeStart} → ${shift.placeEnd}`,
    `Чек-лист: ${shift.done}/${shift.total} выполнено`,
    `Пробег: ${km(Math.max(0, shift.odoEnd - shift.odoStart))}`,
    `Касса: начало ${money(shift.cashStart)}, расходы ${money(shift.cashExpenses)}, штрафы ${money(shift.cashFines)}, итог ${money(shift.cashEnd)}`,
  ];
  if (shift.remarks.length) {
    lines.push('Замечания:');
    shift.remarks.forEach((r) => lines.push(`— ${r.text}${r.comment ? `: ${r.comment}` : ''}${r.photos ? ` (фото: ${r.photos})` : ''}`));
  }
  return lines.join('\n');
}

export type ShiftStartInfo = { place: string; time: string; carId: string; cashStart: string; odoStart: string };
export type ShiftEndInfo = { place: string; time: string; cashEnd: string; cashExpenses: string; cashFines: string; odoEnd: string };

export function buildWhatsAppSummary(
  driver: ProtoDriver,
  cars: ProtoCar[],
  checked: number,
  total: number,
  shiftDate: string,
  start?: ShiftStartInfo,
  end?: ShiftEndInfo
): string {
  const lines = [
    'Отчёт по смене — Smena',
    `Водитель: ${driver.lastName} ${driver.firstName}`,
    `Авто: ${carLabel(cars, start?.carId || driver.carId)}`,
    `Дата: ${shiftDate}`,
  ];
  if (start) lines.push(`Начало: ${start.time}, ${start.place || '—'}`);
  if (end) lines.push(`Завершение: ${end.time}, ${end.place || '—'}`);
  lines.push(`Чек-лист: ${checked}/${total} выполнено`);
  if (start && end && start.odoStart && end.odoEnd) {
    lines.push(`Пробег: ${km(Math.max(0, Number(end.odoEnd) - Number(start.odoStart)))}`);
  }
  if (start || end) {
    lines.push(
      `Касса: начало ${money(start?.cashStart || 0)}` +
        (end ? `, расходы ${money(end.cashExpenses || 0)}, штрафы ${money(end.cashFines || 0)}, конец ${money(end.cashEnd || 0)}` : '')
    );
  }
  return lines.join('\n');
}

/** CSV с BOM — иначе Excel на Windows ломает кириллицу. */
export function toCsv(rows: (string | number)[][]): string {
  const body = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  return '﻿' + body;
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function shiftsToCsv(shifts: ProtoShift[], drivers: ProtoDriver[], cars: ProtoCar[]): string {
  const header = [
    'Дата', 'Водитель', 'Авто', 'Начало', 'Завершение', 'Место начала', 'Место завершения',
    'Чек-лист выполнено', 'Чек-лист всего', 'Пробег, км',
    'Касса начало', 'Расходы', 'Штрафы', 'Касса конец', 'Замечания',
  ];
  const rows = shifts.map((s) => [
    formatDateRu(s.date),
    driverName(drivers, s.driverId),
    carLabel(cars, s.carId),
    s.timeStart,
    s.timeEnd,
    s.placeStart,
    s.placeEnd,
    s.done,
    s.total,
    Math.max(0, s.odoEnd - s.odoStart),
    s.cashStart,
    s.cashExpenses,
    s.cashFines,
    s.cashEnd,
    s.remarks.map((r) => `${r.text}${r.comment ? `: ${r.comment}` : ''}`).join(' | '),
  ]);
  return toCsv([header, ...rows]);
}
