'use client';

// Копия черновика смены в самом телефоне.
//
// Основное хранилище — сервер, но водитель работает в машине: подземный
// паркинг, лифт, район без сети. Пока связи нет, отметки чек-листа должны
// оставаться целыми, даже если приложение перезапустят, — поэтому каждая
// правка пишется ещё и в localStorage, а при запуске берётся та копия, которая
// новее.
//
// Всё обёрнуто в try/catch: в приватном окне и при запрете на данные сайта
// localStorage бросает исключение, и из-за этого не должна ломаться смена.

const KEY_PREFIX = 'smena.draft.';

function key(driverId: string): string {
  return KEY_PREFIX + driverId;
}

export function readLocalDraft<T>(driverId: string): T | null {
  try {
    const raw = window.localStorage.getItem(key(driverId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(driverId: string, data: unknown): void {
  try {
    window.localStorage.setItem(key(driverId), JSON.stringify(data));
  } catch {
    // Место кончилось или хранилище запрещено — черновик всё равно уходит на
    // сервер, просто без локальной страховки.
  }
}

export function clearLocalDraft(driverId: string): void {
  try {
    window.localStorage.removeItem(key(driverId));
  } catch {
    // Нечего убирать.
  }
}
