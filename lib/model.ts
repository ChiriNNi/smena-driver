// Типы, которыми обмениваются API и клиент, и преобразование строк БД в них.
//
// В БД имена колонок snake_case (SQL-стиль), в интерфейсе — camelCase, поэтому
// перевод собран в одном месте: маршруты возвращают уже готовые объекты, а
// компоненты не знают про устройство таблиц.

import { formatPhone } from './phone';

export type Role = 'driver' | 'admin';

/* ─── Автомобили ─────────────────────────────────────────────────────────── */

export type Car = {
  id: string;
  model: string;
  plate: string;
  active: boolean;
};

export type CarRow = { id: string; model: string; plate: string; active: boolean };

export function toCar(r: CarRow): Car {
  return { id: r.id, model: r.model, plate: r.plate, active: r.active };
}

export function carLabel(car: Pick<Car, 'model' | 'plate'> | null | undefined): string {
  return car ? `${car.model} — ${car.plate}` : '—';
}

/* ─── Водители и администраторы ──────────────────────────────────────────── */

// pin_hash наружу не отдаётся никогда — в типе его просто нет.
export type Driver = {
  id: string;
  lastName: string;
  firstName: string;
  phone: string; // отформатированный, для показа
  phoneDigits: string; // нормализованный, для поиска и wa.me
  carId: string; // '' — авто не закреплено (обычно у администратора)
  role: Role;
  active: boolean;
  hiredAt: string; // ISO
};

export type DriverRow = {
  id: string;
  last_name: string;
  first_name: string;
  phone_digits: string;
  role: Role;
  active: boolean;
  car_id: string | null;
  hired_at: string;
};

export function toDriver(r: DriverRow): Driver {
  return {
    id: r.id,
    lastName: r.last_name,
    firstName: r.first_name,
    phone: formatPhone(r.phone_digits),
    phoneDigits: r.phone_digits,
    carId: r.car_id ?? '',
    role: r.role,
    active: r.active,
    hiredAt: r.hired_at,
  };
}

export function driverLabel(d: Pick<Driver, 'lastName' | 'firstName'>): string {
  return `${d.lastName} ${d.firstName}`;
}

/* ─── Шаблон чек-листа ───────────────────────────────────────────────────── */

export type PhaseId = 'start' | 'process' | 'end';

export const PHASE_TITLE: Record<PhaseId, string> = {
  start: 'Начало смены',
  process: 'Процесс',
  end: 'Завершение смены',
};

export type TemplateItem = { id: string; text: string; qty?: string };
// slug — постоянный код раздела из начального набора; по нему интерфейс
// подбирает иконку. У добавленных администратором разделов пустой.
export type TemplateSection = { id: string; title: string; slug: string; notable: boolean; items: TemplateItem[] };
export type TemplatePhase = { id: PhaseId; phase: string; sections: TemplateSection[] };

export function countTemplateItems(template: TemplatePhase[]): number {
  return template.reduce((sum, ph) => sum + ph.sections.reduce((s, sec) => s + sec.items.length, 0), 0);
}

/* ─── Смены ──────────────────────────────────────────────────────────────── */

export type ShiftRemark = { text: string; comment: string; photos: number };

export type Shift = {
  id: string;
  driverId: string;
  carId: string;
  driverLabel: string;
  carLabel: string;
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

export type ShiftRow = {
  id: string;
  driver_id: string | null;
  car_id: string | null;
  driver_label: string;
  car_label: string;
  date_iso: string;
  time_start: string;
  time_end: string;
  place_start: string;
  place_end: string;
  cash_start: string;
  cash_end: string;
  cash_expenses: string;
  cash_fines: string;
  odo_start: string;
  odo_end: string;
  checklist_done: number;
  checklist_total: number;
};

// pg отдаёт NUMERIC строкой (иначе теряется точность на больших числах) —
// приводим к числу здесь, чтобы в интерфейс попадали уже числа.
function num(v: string | number | null): number {
  return Number(v) || 0;
}

export function toShift(r: ShiftRow, remarks: ShiftRemark[] = []): Shift {
  return {
    id: r.id,
    driverId: r.driver_id ?? '',
    carId: r.car_id ?? '',
    driverLabel: r.driver_label,
    carLabel: r.car_label,
    date: r.date_iso,
    timeStart: r.time_start,
    timeEnd: r.time_end,
    placeStart: r.place_start,
    placeEnd: r.place_end,
    done: r.checklist_done,
    total: r.checklist_total,
    cashStart: num(r.cash_start),
    cashEnd: num(r.cash_end),
    cashExpenses: num(r.cash_expenses),
    cashFines: num(r.cash_fines),
    odoStart: num(r.odo_start),
    odoEnd: num(r.odo_end),
    remarks,
  };
}

/** Один пункт снимка чек-листа смены — для подробного отчёта. */
export type ShiftItem = {
  id: string;
  phase: string;
  sectionTitle: string;
  text: string;
  checked: boolean;
  comment: string;
  /** Временные ссылки на фото из приватного бакета (действуют ограниченное время). */
  photoUrls: string[];
};

/* ─── Автопарк ───────────────────────────────────────────────────────────── */

export const EXPENSE_CATEGORIES = ['Топливо', 'Мойка', 'ТО и ремонт', 'Штраф', 'Прочее'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Expense = {
  id: string;
  carId: string;
  driverId: string;
  date: string;
  category: string;
  amount: number;
  comment: string;
};

export type ExpenseRow = {
  id: string;
  car_id: string | null;
  driver_id: string | null;
  date_iso: string;
  category: string;
  amount: string;
  comment: string;
};

export function toExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    carId: r.car_id ?? '',
    driverId: r.driver_id ?? '',
    date: r.date_iso,
    category: r.category,
    amount: num(r.amount),
    comment: r.comment,
  };
}

export const REMINDER_KINDS = ['ТО', 'Страховка', 'Техосмотр'] as const;

export type Reminder = { id: string; carId: string; kind: string; dueDate: string; note: string };
export type ReminderRow = { id: string; car_id: string; kind: string; due_date: string; note: string };

export function toReminder(r: ReminderRow): Reminder {
  return { id: r.id, carId: r.car_id, kind: r.kind, dueDate: r.due_date, note: r.note };
}

export type Assignment = {
  id: string;
  date: string;
  driverId: string;
  carId: string;
  timeStart: string;
  timeEnd: string;
};

export type AssignmentRow = {
  id: string;
  date_iso: string;
  driver_id: string;
  car_id: string;
  time_start: string;
  time_end: string;
};

export function toAssignment(r: AssignmentRow): Assignment {
  return {
    id: r.id,
    date: r.date_iso,
    driverId: r.driver_id,
    carId: r.car_id,
    timeStart: r.time_start,
    timeEnd: r.time_end,
  };
}

/* ─── Правила и тест по ТБ ───────────────────────────────────────────────── */

/**
 * Блок регламента: обязанность (duty) или правило (rule).
 * У обязанностей subtitle — частота: «Ежедневно», «По потребности».
 */
export type RuleKind = 'duty' | 'rule';

export const RULE_KIND_TITLE: Record<RuleKind, string> = {
  duty: 'Обязанности',
  rule: 'Правила и регламенты',
};

export type Rule = { id: string; kind: RuleKind; title: string; subtitle: string; body: string; points: string[] };
export type RuleRow = { id: string; kind: string; title: string; subtitle: string; body: string; points: string[] };

export function toRule(r: RuleRow): Rule {
  return {
    id: r.id,
    kind: r.kind === 'duty' ? 'duty' : 'rule',
    title: r.title,
    subtitle: r.subtitle ?? '',
    body: r.body ?? '',
    points: r.points ?? [],
  };
}

/** Вопрос в том виде, в каком его получает водитель — без правильного ответа. */
export type QuizQuestionPublic = { id: string; question: string; options: string[] };
/** Вопрос для редактора администратора — с правильным ответом и темой. */
export type QuizQuestionAdmin = QuizQuestionPublic & { correct: number; topic: string };

export type QuizRow = { id: string; question: string; options: string[]; correct_index: number; topic?: string };

export function toQuizPublic(r: QuizRow): QuizQuestionPublic {
  return { id: r.id, question: r.question, options: r.options };
}

export function toQuizAdmin(r: QuizRow): QuizQuestionAdmin {
  return { id: r.id, question: r.question, options: r.options, correct: r.correct_index, topic: r.topic ?? '' };
}

export type QuizAttempt = {
  id: string;
  driverId: string;
  date: string;
  score: number;
  total: number;
  passed: boolean;
  /** Когда подписано ознакомление и под каким именем (снимок на момент подписи). */
  signedAt: string | null;
  signatureName: string;
};

export type QuizAttemptRow = {
  id: string;
  driver_id: string;
  date_iso: string;
  score: number;
  total: number;
  passed: boolean;
  signed_at?: string | null;
  signature_name?: string | null;
};

export function toAttempt(r: QuizAttemptRow): QuizAttempt {
  return {
    id: r.id,
    driverId: r.driver_id,
    date: r.date_iso,
    score: r.score,
    total: r.total,
    passed: r.passed,
    signedAt: r.signed_at ?? null,
    signatureName: r.signature_name ?? '',
  };
}

/**
 * Допуск к смене. Тест сдаётся перед каждой сменой, поэтому «срока действия»
 * в днях больше нет — есть причина, по которой допуска сейчас нет:
 *  not-passed — тест ещё не проходили;
 *  failed     — последняя попытка не сдана;
 *  not-signed — тест сдан, но подпись об ознакомлении не поставлена;
 *  used       — по этой сдаче уже закрыта смена, нужна новая;
 *  stale      — сдано слишком давно, а смена так и не началась.
 */
export type BriefingReason = 'ok' | 'not-passed' | 'failed' | 'not-signed' | 'used' | 'stale';

export type BriefingStatus = {
  valid: boolean;
  reason: BriefingReason;
  latest: QuizAttempt | null;
  /** Сданный, но не подписанный тест — водитель продолжит с шага подписи. */
  pendingSignature: { attemptId: string; score: number; total: number } | null;
  /** Есть ли вообще вопросы: если тест не настроен, смену блокировать нечем. */
  configured: boolean;
  /** Сколько вопросов достаётся на попытку и сколько нужно для допуска. */
  questionsPerAttempt: number;
  passScore: number;
  freshHours: number;
};
