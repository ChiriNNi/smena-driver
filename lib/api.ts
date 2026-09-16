// Типизированный клиент API для компонентов кабинета.
//
// Один файл на все запросы: компоненты работают через хранилище
// (components/cabinet/store.tsx), которое обращается сюда, а не разбрасывают
// fetch и «магические» адреса по экранам.

import type {
  BriefingStatus,
  Car,
  Driver,
  Expense,
  QuizAttempt,
  QuizQuestionAdmin,
  QuizQuestionPublic,
  Reminder,
  Rule,
  RuleKind,
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
  /** Настроено ли хранилище: без него загрузка фото недоступна. */
  photoUploadEnabled?: boolean;
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
  update: (id: string, patch: Partial<DriverInput> & { active?: boolean; resetPin?: boolean }) =>
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
  cashIncome: number;
  cashIncomeNote: string;
  cashExpenses: number;
  cashExpensesNote: string;
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

/** Что переносится в новую смену с предыдущей: остаток кассы и одометр. */
export type ShiftOpening = {
  cash: number | null;
  cashDate: string | null;
  odo: number | null;
  odoDate: string | null;
};

/** Поля, которые администратор может исправить в сданной смене. */
export type ShiftPatch = Partial<{
  date: string;
  timeStart: string;
  timeEnd: string;
  placeStart: string;
  placeEnd: string;
  cashStart: number;
  cashIncome: number;
  cashIncomeNote: string;
  cashExpenses: number;
  cashExpensesNote: string;
  cashFines: number;
  odoStart: number;
  odoEnd: number;
}>;

export const shifts = {
  list: (filters: ShiftFilters = {}) => get<{ shifts: Shift[] }>(`/api/shifts${qs(filters)}`).then((r) => r.shifts),
  detail: (id: string) => get<{ shift: Shift; items: ShiftItem[]; summary: string }>(`/api/shifts/${id}`),
  finish: (data: FinishShiftInput) =>
    send<{ shift: Shift; summary?: string; duplicate?: boolean }>('/api/shifts', 'POST', data),
  /** Исправление сданной смены администратором — смена помечается как правленая. */
  update: (id: string, patch: ShiftPatch) =>
    send<{ shift: Shift; summary: string }>(`/api/shifts/${id}`, 'PATCH', patch).then((r) => r.shift),
  /** Начальные показания новой смены: остаток кассы водителя и одометр машины. */
  opening: (carId?: string) =>
    get<{ opening: ShiftOpening }>(`/api/shifts/opening${qs({ carId })}`).then((r) => r.opening),
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

/* ─── Правила и инструктаж ───────────────────────────────────────────────── */

export type RuleInput = { kind: RuleKind; title: string; subtitle?: string; points: string[] };

export const rules = {
  list: () => get<{ rules: Rule[] }>('/api/rules').then((r) => r.rules),
  create: (data: RuleInput) => send<{ rule: Rule }>('/api/rules', 'POST', data).then((r) => r.rule),
  update: (id: string, patch: Partial<RuleInput> & { position?: number }) =>
    send<{ rule: Rule }>(`/api/rules/${id}`, 'PATCH', patch).then((r) => r.rule),
  remove: (id: string) => send<{ ok: true }>(`/api/rules/${id}`, 'DELETE'),
};

/** Начатая попытка: набор вопросов зафиксирован на сервере. */
export type StartedAttempt = {
  attemptId: string;
  questions: QuizQuestionPublic[];
  passScore: number;
};

/** Разбор одной попытки — то, что показывается водителю на экране результата. */
export type AttemptResult = {
  score: number;
  total: number;
  passed: boolean;
  review: { id: string; question: string; options: string[]; correct: number; given: number | null; topic: string }[];
  status: BriefingStatus;
};

/** Сводка по тестам для администратора. */
export type QuizSummary = {
  byDriver: {
    driverId: string;
    driverLabel: string;
    attempts: number;
    passed: number;
    signed: number;
    failed: number;
    lastAt: string | null;
    lastScore: string | null;
    averagePercent: number;
  }[];
  byTopic: { topic: string; asked: number; wrong: number; errorPercent: number }[];
  hardestQuestions: { id: string; question: string; topic: string; asked: number; wrong: number }[];
  totals: { attempts: number; passed: number; drivers: number };
};

export type QuestionInput = { question: string; options: string[]; correct: number; topic?: string };

export const quiz = {
  /** Весь банк вопросов — для редактора администратора. */
  list: <T extends QuizQuestionPublic | QuizQuestionAdmin>() => get<{ quiz: T[] }>('/api/quiz').then((r) => r.quiz),
  create: (data: QuestionInput) => send<{ question: QuizQuestionAdmin }>('/api/quiz', 'POST', data).then((r) => r.question),
  update: (id: string, data: QuestionInput) =>
    send<{ question: QuizQuestionAdmin }>(`/api/quiz/${id}`, 'PATCH', data).then((r) => r.question),
  remove: (id: string) => send<{ ok: true }>(`/api/quiz/${id}`, 'DELETE'),
  /** Начать попытку: сервер выдаёт случайную выборку вопросов из банка. */
  start: () => send<StartedAttempt>('/api/quiz/attempt', 'POST'),
  /** Отправить ответы этой попытки: проверяет сервер, результат идёт в журнал. */
  submit: (attemptId: string, answers: Record<string, number>) =>
    send<AttemptResult>('/api/quiz/attempt', 'PUT', { attemptId, answers }),
  /** Подпись об ознакомлении: ФИО сервер подставляет сам из профиля. */
  sign: (attemptId: string) =>
    send<{ briefing: BriefingStatus }>('/api/quiz/attempt/sign', 'POST', { attemptId }).then((r) => r.briefing),
  /** Журнал ознакомления: последняя попытка каждого водителя. */
  attempts: () => get<{ attempts: QuizAttempt[] }>('/api/quiz/attempt').then((r) => r.attempts),
  /** Сводка: кто как сдаёт и в каких темах ошибаются чаще. */
  summary: () => get<{ summary: QuizSummary }>('/api/quiz/summary').then((r) => r.summary),
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
