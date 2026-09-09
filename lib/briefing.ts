import { query, queryOne } from './db';
import { ApiError } from './api-helpers';
import { toAttempt, type BriefingStatus, type QuizAttemptRow, type QuizRow } from './model';
import { getSettings } from './settings';

// Инструктаж по ТБ: допуск к смене и проверка теста.
//
// Ответы проверяются только здесь, на сервере. Клиенту вопросы уходят без
// поля correct_index — иначе правильные варианты видно в исходниках страницы,
// и тест перестаёт что-либо проверять.

const ATTEMPT_FIELDS = 'id, driver_id, date_iso::text AS date_iso, score, total, passed';

async function latestAttempt(driverId: string) {
  const row = await queryOne<QuizAttemptRow>(
    `SELECT ${ATTEMPT_FIELDS} FROM quiz_attempts WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [driverId]
  );
  return row ? toAttempt(row) : null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Действует ли допуск: тест сдан без ошибок и не позже N дней назад. */
export async function getBriefingStatus(driverId: string): Promise<BriefingStatus> {
  const [{ briefingValidDays }, latest, countRow] = await Promise.all([
    getSettings(),
    latestAttempt(driverId),
    queryOne<{ n: string }>('SELECT count(*)::text AS n FROM quiz_questions WHERE active'),
  ]);

  const configured = Number(countRow?.n ?? 0) > 0;
  const validUntil = latest?.passed ? addDays(latest.date, briefingValidDays) : null;
  // Тест не настроен — блокировать смену нечем, иначе водитель не сможет работать.
  const valid = !configured || Boolean(validUntil && validUntil >= new Date().toISOString().slice(0, 10));

  return { valid, validDays: briefingValidDays, validUntil, latest, configured };
}

/** Тот же вопрос, что и на экране разбора: что выбрал водитель и что верно. */
export type AnswerReview = {
  id: string;
  question: string;
  options: string[];
  correct: number;
  given: number | null;
};

export type AttemptResult = {
  score: number;
  total: number;
  passed: boolean;
  review: AnswerReview[];
  status: BriefingStatus;
};

/**
 * Проверяет ответы, записывает попытку в журнал (с любым результатом —
 * администратор должен видеть и неудачные) и возвращает разбор.
 */
export async function scoreAttempt(driverId: string, answers: Record<string, number>): Promise<AttemptResult> {
  const questions = await query<QuizRow>(
    'SELECT id, question, options, correct_index FROM quiz_questions WHERE active ORDER BY position, question'
  );
  if (questions.length === 0) throw new ApiError('Тест по ТБ ещё не настроен администратором.', 409);

  const review: AnswerReview[] = questions.map((q) => {
    const raw = answers[q.id];
    return {
      id: q.id,
      question: q.question,
      options: q.options,
      correct: q.correct_index,
      given: Number.isInteger(raw) ? raw : null,
    };
  });

  const score = review.filter((r) => r.given === r.correct).length;
  const total = questions.length;
  // Допуск даётся только за безошибочный результат — так согласовано в спецификации.
  const passed = score === total;

  await query('INSERT INTO quiz_attempts (driver_id, score, total, passed) VALUES ($1, $2, $3, $4)', [
    driverId,
    score,
    total,
    passed,
  ]);

  return { score, total, passed, review, status: await getBriefingStatus(driverId) };
}
