// Типизированный клиент API для компонентов кабинета.
//
// Один файл на все запросы: подключение интерфейса к серверу сводится к
// замене обращений к демо-хранилищу (components/proto/store.tsx) на вызовы
// отсюда, без разбросанных по компонентам fetch и «магических» адресов.

import type {
  Assignment,
  BriefingStatus,
  Car,
  Driver,
  Expense,
  QuizAttempt,
  QuizQuestionAdmin,
  QuizQuestionPublic,
  Reminder,
  Rule,
  Shift,
  ShiftItem,
  TemplatePhase,
} from './model';
import type { AppSettings } from './settings';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError((data as { error?: string } | null)?.error || `Ошибка запроса (${res.status})`, res.status);
  }
  return data as T;
}

function get<T>(url: string): Promise<T> {
  return request<T>(url);
}

function send<T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return request<T>(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/* ─── Сессия ─────────────────────────────────────────────────────────────── */

export type SessionResponse = {
  user: Driver | null;
  briefing?: BriefingStatus;
  settings?: AppSettings;
};

export const session = {
  /** Кто вошёл + допуск по ТБ + настройки. Вызывается при запуске приложения. */
  me: () => get<SessionResponse>('/api/session'),
  login: (phone: string, pin: string) => send<SessionResponse>('/api/session', 'POST', { phone, pin }),
  logout: () => send<{ ok: true }>('/api/session', 'DELETE'),
};

/* ─── Справочники ────────────────────────────────────────────────────────── */

export const cars = {
  list: () => get<{ cars: Car[] }>('/api/cars').then((r) => r.cars),
  create: (data: { model: string; plate: string; active?: boolean }) =>
    send<{ car: Car }>('/api/cars', 'POST', data).then((r) => r.car),
  update: (id: string, patch: Partial<Pick<Car, 'model' | 'plate' | 'active'>>) =>
    send<{ car: Car }>(`/api/cars/${id}`, 'PATCH', patch).then((r) => r.car),
  remove: (id: string) => send<{ ok: true }>(`/api/cars/${id}`, 'DELETE'),
};

export type DriverInput = {
  lastName: string;
  firstName: string;
  phone: string;
  carId?: string;
  role?: 'driver' | 'admin';
  hiredAt?: string;
  pin?: string;
};

export const drivers = {
  list: () => get<{ drivers: Driver[] }>('/api/drivers').then((r) => r.drivers),
  create: (data: DriverInput) => send<{ driver: Driver }>('/api/drivers', 'POST', data).then((r) => r.driver),
  update: (id: string, patch: Partial<DriverInput> & { active?: boolean }) =>
    send<{ driver: Driver }>(`/api/drivers/${id}`, 'PATCH', patch).then((r) => r.driver),
  /** Сброс PIN к последним 4 цифрам номера — «водитель забыл PIN». */
  resetPin: (id: string) => send<{ driver: Driver }>(`/api/drivers/${id}`, 'PATCH', { resetPin: true }).then((r) => r.driver),
  remove: (id: string) => send<{ ok: true }>(`/api/drivers/${id}`, 'DELETE'),
};

/* ─── Чек-лист и смены ───────────────────────────────────────────────────── */

export const checklist = {
  get: () => get<{ checklist: TemplatePhase[]; total: number }>('/api/checklist'),
  save: (template: TemplatePhase[]) =>
    send<{ checklist: TemplatePhase[]; total: number }>('/api/checklist', 'PUT', { checklist: template }),
};

export type ShiftFilters = {
  driverId?: string;
  carId?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
};

export type FinishShiftInput = {
  /** Ключ идемпотентности: один и тот же для всех повторов одного завершения. */
  clientRequestId: string;
  carId: string;
  date?: string;
  timeStart: string;
  timeEnd: string;
  placeStart: string;
  placeEnd: string;
  cashStart: number;
  cashEnd: number;
  cashExpenses: number;
  cashFines: number;
  odoStart: number;
  odoEnd: number;
  items: {
    phase: string;
    sectionTitle: string;
    text: string;
    checked: boolean;
    comment: string;
    photoPaths: string[];
  }[];
};

export const shifts = {
  list: (filters: ShiftFilters = {}) => get<{ shifts: Shift[] }>(`/api/shifts${qs(filters)}`).then((r) => r.shifts),
  detail: (id: string) => get<{ shift: Shift; items: ShiftItem[]; summary: string }>(`/api/shifts/${id}`),
  finish: (data: FinishShiftInput) =>
    send<{ shift: Shift; summary?: string; duplicate?: boolean }>('/api/shifts', 'POST', data),
  /** Адрес выгрузки — открывается ссылкой, файл отдаёт сервер. */
  exportUrl: (format: 'csv' | 'xlsx', filters: ShiftFilters = {}) =>
    `/api/export/shifts${qs({ ...filters, format })}`,
};

export const draft = {
  get: <T>() => get<{ draft: T | null; updatedAt: string | null }>('/api/draft'),
  save: (data: unknown) => send<{ ok: true; updatedAt: string | null }>('/api/draft', 'PUT', data),
  clear: () => send<{ ok: true }>('/api/draft', 'DELETE'),
};

/* ─── Автопарк ───────────────────────────────────────────────────────────── */

export const expenses = {
  list: (filters: { carId?: string; from?: string; to?: string } = {}) =>
    get<{ expenses: Expense[] }>(`/api/expenses${qs(filters)}`).then((r) => r.expenses),
  create: (data: { carId: string; driverId?: string; date?: string; category: string; amount: number; comment?: string }) =>
    send<{ expense: Expense }>('/api/expenses', 'POST', data).then((r) => r.expense),
  remove: (id: string) => send<{ ok: true }>(`/api/expenses/${id}`, 'DELETE'),
};

export const reminders = {
  list: () => get<{ reminders: Reminder[] }>('/api/reminders').then((r) => r.reminders),
  create: (data: { carId: string; kind: string; dueDate: string; note?: string }) =>
    send<{ reminder: Reminder }>('/api/reminders', 'POST', data).then((r) => r.reminder),
  update: (id: string, patch: Partial<{ carId: string; kind: string; dueDate: string; note: string }>) =>
    send<{ reminder: Reminder }>(`/api/reminders/${id}`, 'PATCH', patch).then((r) => r.reminder),
  remove: (id: string) => send<{ ok: true }>(`/api/reminders/${id}`, 'DELETE'),
};

export const assignments = {
  list: (filters: { from?: string; to?: string } = {}) =>
    get<{ assignments: Assignment[] }>(`/api/assignments${qs(filters)}`).then((r) => r.assignments),
  create: (data: { date: string; driverId: string; carId: string; timeStart: string; timeEnd: string }) =>
    send<{ assignment: Assignment }>('/api/assignments', 'POST', data).then((r) => r.assignment),
  remove: (id: string) => send<{ ok: true }>(`/api/assignments/${id}`, 'DELETE'),
};

/* ─── Правила и инструктаж ───────────────────────────────────────────────── */

export const rules = {
  list: () => get<{ rules: Rule[] }>('/api/rules').then((r) => r.rules),
  create: (data: { title: string; body?: string }) => send<{ rule: Rule }>('/api/rules', 'POST', data).then((r) => r.rule),
  update: (id: string, patch: Partial<{ title: string; body: string; position: number }>) =>
    send<{ rule: Rule }>(`/api/rules/${id}`, 'PATCH', patch).then((r) => r.rule),
  remove: (id: string) => send<{ ok: true }>(`/api/rules/${id}`, 'DELETE'),
};

/** Разбор одной попытки — то, что показывается водителю на экране результата. */
export type AttemptResult = {
  score: number;
  total: number;
  passed: boolean;
  review: { id: string; question: string; options: string[]; correct: number; given: number | null }[];
  status: BriefingStatus;
};

export const quiz = {
  /** Водителю приходят вопросы без правильных ответов, администратору — с ними. */
  list: <T extends QuizQuestionPublic | QuizQuestionAdmin>() => get<{ quiz: T[] }>('/api/quiz').then((r) => r.quiz),
  create: (data: { question: string; options: string[]; correct: number }) =>
    send<{ question: QuizQuestionAdmin }>('/api/quiz', 'POST', data).then((r) => r.question),
  update: (id: string, data: { question: string; options: string[]; correct: number }) =>
    send<{ question: QuizQuestionAdmin }>(`/api/quiz/${id}`, 'PATCH', data).then((r) => r.question),
  remove: (id: string) => send<{ ok: true }>(`/api/quiz/${id}`, 'DELETE'),
  /** Отправка ответов: проверяет сервер, попытка попадает в журнал. */
  submit: (answers: Record<string, number>) => send<AttemptResult>('/api/quiz/attempt', 'POST', { answers }),
  /** Журнал ознакомления: последняя попытка каждого водителя. */
  attempts: () => get<{ attempts: QuizAttempt[] }>('/api/quiz/attempt').then((r) => r.attempts),
};

export const briefing = {
  status: (driverId?: string) =>
    get<{ briefing: BriefingStatus }>(`/api/briefing${qs({ driverId })}`).then((r) => r.briefing),
};

/* ─── Фото и настройки ───────────────────────────────────────────────────── */

export const photos = {
  /**
   * Загрузка фото к замечанию. Возвращает путь в бакете (его нужно приложить
   * к смене) и временную ссылку для превью.
   */
  upload: async (file: File): Promise<{ path: string; url: string | null }> => {
    const form = new FormData();
    form.append('file', file);
    return request<{ path: string; url: string | null }>('/api/photos', { method: 'POST', body: form });
  },
  remove: (path: string) => send<{ ok: true }>(`/api/photos${qs({ path })}`, 'DELETE'),
};

export const settings = {
  get: () => get<{ settings: AppSettings; photoUploadEnabled: boolean }>('/api/settings'),
  update: (patch: Partial<AppSettings>) => send<{ settings: AppSettings }>('/api/settings', 'PUT', patch).then((r) => r.settings),
};
