// Демо-данные и типы для прототипа личного кабинета (app/proto).
// Ничего здесь не ходит в БД — всё живёт в памяти браузера, чтобы можно было
// смотреть и обсуждать поведение до того, как будет готова реальная схема.

import { CHECKLIST as REAL_CHECKLIST, type ChecklistPhase } from './checklist-data';

export type Role = 'driver' | 'admin';

export type ProtoDriver = {
  id: string;
  lastName: string;
  firstName: string;
  phone: string; // формат +7 701 234 56 78
  car: string;
  pin: string; // последние 4 цифры телефона
  role: Role;
};

export const CARS = ['Mercedes-Benz W223 — 001ICG01', 'Link&Co — 001IC02'];

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

export function nowHHMM(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function pinFromPhone(phone: string): string {
  const d = onlyDigits(phone);
  return d.slice(-4);
}

export function formatPhoneInput(raw: string): string {
  const d = onlyDigits(raw).replace(/^8/, '7').slice(0, 11);
  if (!d) return '';
  let out = '+7';
  const rest = d.startsWith('7') ? d.slice(1) : d;
  if (rest.length > 0) out += ' ' + rest.slice(0, 3);
  if (rest.length > 3) out += ' ' + rest.slice(3, 6);
  if (rest.length > 6) out += ' ' + rest.slice(6, 8);
  if (rest.length > 8) out += ' ' + rest.slice(8, 10);
  return out;
}

export const SEED_DRIVERS: ProtoDriver[] = [
  { id: 'd1', lastName: 'Ахметов', firstName: 'Данияр', phone: '+7 701 234 56 78', car: CARS[0], pin: '5678', role: 'driver' },
  { id: 'd2', lastName: 'Сергеева', firstName: 'Алия', phone: '+7 705 998 41 20', car: CARS[1], pin: '4120', role: 'driver' },
  { id: 'a1', lastName: 'Бекова', firstName: 'Гульмира', phone: '+7 707 555 90 11', car: '—', pin: '9011', role: 'admin' },
];

export type NoteEntry = { comment: string; photos: string[] }; // photos — object URL для превью

export type ShiftRemark = { text: string; hasPhoto: boolean };

export type ProtoShift = {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  placeStart: string;
  placeEnd: string;
  car: string;
  done: number;
  total: number;
  cashStart: number;
  cashEnd: number;
  cashExpenses: number;
  cashFines: number;
  cashNote: string;
  remarks: ShiftRemark[];
};

export const SEED_HISTORY: ProtoShift[] = [
  {
    id: 's1', date: '05.09.2026', timeStart: '08:00', timeEnd: '20:00',
    placeStart: 'Офис, Алматы', placeEnd: 'Офис, Алматы', car: CARS[0], done: 42, total: 45,
    cashStart: 15000, cashEnd: 18500, cashExpenses: 3500, cashFines: 0,
    cashNote: 'Касса сведена, расхождений нет', remarks: [],
  },
  {
    id: 's2', date: '03.09.2026', timeStart: '09:00', timeEnd: '21:30',
    placeStart: 'Офис, Алматы', placeEnd: 'Аэропорт', car: CARS[0], done: 45, total: 45,
    cashStart: 12000, cashEnd: 9000, cashExpenses: 8000, cashFines: 5000,
    cashNote: 'Касса сведена, штраф 5 000 ₸ за парковку',
    remarks: [{ text: 'Скол на переднем бампере справа', hasPhoto: true }],
  },
  {
    id: 's3', date: '01.09.2026', timeStart: '08:15', timeEnd: '19:40',
    placeStart: 'Офис, Алматы', placeEnd: 'Офис, Алматы', car: CARS[1], done: 40, total: 45,
    cashStart: 20000, cashEnd: 24200, cashExpenses: 4800, cashFines: 0,
    cashNote: 'Касса сведена, расхождений нет',
    remarks: [
      { text: 'Царапина на двери водителя', hasPhoto: true },
      { text: 'Не хватает зарядки Type-C', hasPhoto: false },
    ],
  },
];

// Мутируемая копия реального чек-листа — редактор администратора в прототипе
// правит именно её, не трогая lib/checklist-data.ts.
export function cloneChecklist(): ChecklistPhase[] {
  return JSON.parse(JSON.stringify(REAL_CHECKLIST));
}

export function buildShiftReportText(driver: ProtoDriver, shift: ProtoShift): string {
  return [
    `Отчёт по смене — Smena`,
    `Водитель: ${driver.lastName} ${driver.firstName}`,
    `Авто: ${shift.car}`,
    `Дата: ${shift.date}, ${shift.timeStart}–${shift.timeEnd}`,
    `Чек-лист: ${shift.done}/${shift.total} выполнено`,
    `Касса: начало ${shift.cashStart.toLocaleString('ru-RU')} ₸, расходы ${shift.cashExpenses.toLocaleString('ru-RU')} ₸, штрафы ${shift.cashFines.toLocaleString('ru-RU')} ₸, итог ${shift.cashEnd.toLocaleString('ru-RU')} ₸`,
    ...(shift.remarks.length ? [`Замечания: ${shift.remarks.map((r) => r.text).join('; ')}`] : []),
  ].join('\n');
}

export type ShiftStartInfo = { place: string; time: string; car: string; cashStart: string };
export type ShiftEndInfo = { place: string; time: string; cashEnd: string; cashExpenses: string; cashFines: string };

export function buildWhatsAppSummary(
  driver: ProtoDriver,
  checked: number,
  total: number,
  shiftDate: string,
  start?: ShiftStartInfo,
  end?: ShiftEndInfo
): string {
  const lines = [
    `Отчёт по смене — Smena`,
    `Водитель: ${driver.lastName} ${driver.firstName}`,
    `Авто: ${start?.car || driver.car}`,
    `Дата: ${shiftDate}`,
  ];
  if (start) lines.push(`Начало: ${start.time}, ${start.place || '—'}`);
  if (end) lines.push(`Завершение: ${end.time}, ${end.place || '—'}`);
  lines.push(`Чек-лист: ${checked}/${total} выполнено`);
  if (start || end) {
    lines.push(
      `Касса: начало ${start?.cashStart || '0'} ₸` +
        (end ? `, расходы ${end.cashExpenses || '0'} ₸, штрафы ${end.cashFines || '0'} ₸, конец ${end.cashEnd || '0'} ₸` : '')
    );
  } else {
    lines.push(`Касса: сведена, расхождений нет`);
  }
  return lines.join('\n');
}
