// Подписи и форматирование для интерфейса.
//
// Компоненты получают из API плоские данные со ссылками по id, а показывать
// нужно «Mercedes-Benz W223 — 001ICG01». Эти функции — единственное место, где
// id превращается в подпись, поэтому в разных экранах одна и та же сущность
// подписана одинаково.

import type { Car, Driver } from './model';

export { formatDateRu as formatDate, km, money, plural, shiftsCount } from './report-text';
export { formatPhoneInput, onlyDigits, pinFromPhone } from './phone';

export function carLabel(cars: Car[], carId: string): string {
  const car = cars.find((c) => c.id === carId);
  return car ? `${car.model} — ${car.plate}` : '—';
}

export function driverName(drivers: Driver[], driverId: string): string {
  const driver = drivers.find((d) => d.id === driverId);
  return driver ? `${driver.lastName} ${driver.firstName}` : '—';
}

export function initials(d: Pick<Driver, 'firstName' | 'lastName'>): string {
  return `${d.firstName[0] ?? ''}${d.lastName[0] ?? ''}`;
}

export function nowHHMM(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Разница в днях между сегодня и ISO-датой: отрицательная — просрочено. */
export function daysUntil(iso: string): number {
  const today = new Date(todayISO()).getTime();
  const target = new Date(iso).getTime();
  return Math.round((target - today) / 86400000);
}

/**
 * Ключ идемпотентности для завершения смены: генерируется один раз на смену,
 * чтобы повторная отправка на плохой связи не создала вторую запись.
 */
export function requestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Фото замечания: путь в бакете уходит на сервер, ссылка нужна для превью. */
export type PhotoRef = { path: string; url: string };

export type NoteEntry = { comment: string; photos: PhotoRef[] };

/* ─── Выгрузка на стороне клиента ────────────────────────────────────────── */

/** CSV с BOM — иначе Excel на Windows ломает кириллицу. */
export function toCsv(rows: (string | number)[][]): string {
  const body = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
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
