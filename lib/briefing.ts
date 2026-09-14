import { query, queryOne } from './db';
import { ApiError } from './api-helpers';
import { toAttempt, type BriefingStatus, type QuizAttempt, type QuizAttemptRow, type QuizQuestionPublic } from './model';
import { getSettings } from './settings';

// Инструктаж по ТБ: допуск к смене, выдача вопросов и проверка ответов.
//
// Два правила, которые задают всю логику:
//  1. Тест сдаётся перед каждой сменой. Допуск действует, пока по нему не
//     закрыли смену, — после этого нужна новая попытка.
//  2. Вопросы выдаются случайной выборкой из общего банка, поэтому заучить
//     «ответы по порядку» нельзя.
//
// Правильные ответы никогда не покидают сервер: водителю вопросы уходят без
// поля correct_index, разбор возвращается уже после отправки.

const ATTEMPT_FIELDS =
  'id, driver_id, date_iso::text AS date_iso, score, total, passed, created_at::text AS created_at';

/** Последняя завершённая попытка водителя. Незавершённые (открыл и бросил) не в счёт. */
async function latestAttempt(driverId: string): Promise<(QuizAttempt & { createdAt: string }) | null> {
  const row = await queryOne<QuizAttemptRow & { created_at: string }>(
    `SELECT ${ATTEMPT_FIELDS} FROM quiz_attempts
     WHERE driver_id = $1 AND finished_at IS NOT NULL
     ORDER BY finished_at DESC LIMIT 1`,
    [driverId]
  );
  return row ? { ...toAttempt(row), createdAt: row.created_at } : null;
}

/**
 * Действует ли допуск к смене.
 *
 * Тест считается пройденным «на смену»: попытка должна быть сдана позже, чем
 * закрыта прошлая смена, и не раньше чем N часов назад. Первое условие и даёт
 * требование «перед каждой сменой», второе отсекает вчерашнюю сдачу, если
 * смена так и не началась.
 */
export async function getBriefingStatus(driverId: string): Promise<BriefingStatus> {
  const [settings, latest, countRow, lastShift] = await Promise.all([
    getSettings(),
    latestAttempt(driverId),
    queryOne<{ n: string }>('SELECT count(*)::text AS n FROM quiz_questions WHERE active'),
    queryOne<{ created_at: string }>(
      'SELECT created_at::text AS created_at FROM shifts WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 1',
      [driverId]
    ),
  ]);

  const configured = Number(countRow?.n ?? 0) > 0;
  const freshMs = settings.briefingFreshHours * 3600 * 1000;

  let valid = false;
  let reason: BriefingStatus['reason'] = 'not-passed';

  if (!configured) {
    // Банк вопросов пуст — блокировать смену нечем, иначе водитель не сможет работать.
    valid = true;
    reason = 'ok';
  } else if (!latest || !latest.passed) {
    valid = false;
    reason = latest ? 'failed' : 'not-passed';
  } else {
    const attemptAt = new Date(latest.createdAt).getTime();
    const usedByShift = lastShift ? new Date(lastShift.created_at).getTime() > attemptAt : false;
    const stale = Date.now() - attemptAt > freshMs;

    valid = !usedByShift && !stale;
    reason = usedByShift ? 'used' : stale ? 'stale' : 'ok';
  }

  return {
    valid,
    reason,
    latest,
    configured,
    questionsPerAttempt: Math.min(settings.quizPerAttempt, Number(countRow?.n ?? 0) || settings.quizPerAttempt),
    passScore: settings.quizPassScore,
    freshHours: settings.briefingFreshHours,
  };
}

/* ─── Попытка ────────────────────────────────────────────────────────────── */

export type StartedAttempt = { attemptId: string; questions: QuizQuestionPublic[]; passScore: number };

/**
 * Начало попытки: сервер сам выбирает вопросы случайно и запоминает набор.
 * Без этого можно было бы прислать ответ на один вопрос и получить «1 из 1».
 */
export async function startAttempt(driverId: string): Promise<StartedAttempt> {
  const settings = await getSettings();

  const questions = await query<{ id: string; question: string; options: string[] }>(
    'SELECT id, question, options FROM quiz_questions WHERE active ORDER BY random() LIMIT $1',
    [settings.quizPerAttempt]
  );
  if (questions.length === 0) throw new ApiError('Тест по ТБ ещё не настроен администратором.', 409);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO quiz_attempts (driver_id, question_ids, score, total, passed)
     VALUES ($1, $2::uuid[], 0, $3, false) RETURNING id`,
    [driverId, questions.map((q) => q.id), questions.length]
  );
  if (!row) throw new ApiError('Не удалось начать тест.', 500);

  return {
    attemptId: row.id,
    questions,
    passScore: Math.min(settings.quizPassScore, questions.length),
  };
}

/** Разбор ответа — то же, что видит водитель на экране результата. */
export type AnswerReview = {
  id: string;
  question: string;
  options: string[];
  correct: number;
  given: number | null;
  topic: string;
};

export type AttemptResult = {
  score: number;
  total: number;
  passed: boolean;
  review: AnswerReview[];
  status: BriefingStatus;
};

/**
 * Проверка ответов. Считается только по вопросам, выданным в этой попытке,
 * и только один раз — повторная отправка той же попытки отклоняется.
 */
export async function submitAttempt(
  driverId: string,
  attemptId: string,
  answers: Record<string, number>
): Promise<AttemptResult> {
  const attempt = await queryOne<{ question_ids: string[]; finished_at: string | null }>(
    'SELECT question_ids, finished_at FROM quiz_attempts WHERE id = $1 AND driver_id = $2',
    [attemptId, driverId]
  );
  if (!attempt) throw new ApiError('Попытка не найдена.', 404);
  if (attempt.finished_at) throw new ApiError('Эта попытка уже завершена.', 409);

  const questions = await query<{ id: string; question: string; options: string[]; correct_index: number; topic: string }>(
    'SELECT id, question, options, correct_index, topic FROM quiz_questions WHERE id = ANY($1::uuid[])',
    [attempt.question_ids]
  );

  // Порядок — как при выдаче, иначе разбор не совпадёт с тем, что видел водитель.
  const byId = new Map(questions.map((q) => [q.id, q]));
  const review: AnswerReview[] = attempt.question_ids
    .map((id) => byId.get(id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => {
      const raw = answers[q.id];
      return {
        id: q.id,
        question: q.question,
        options: q.options,
        correct: q.correct_index,
        given: Number.isInteger(raw) ? raw : null,
        topic: q.topic,
      };
    });

  const score = review.filter((r) => r.given === r.correct).length;
  const total = attempt.question_ids.length;
  const { quizPassScore } = await getSettings();
  const passed = score >= Math.min(quizPassScore, total);

  await query(
    `UPDATE quiz_attempts
     SET score = $2, total = $3, passed = $4, answers = $5::jsonb, finished_at = now(), date_iso = current_date
     WHERE id = $1`,
    [attemptId, score, total, passed, JSON.stringify(answers)]
  );

  return { score, total, passed, review, status: await getBriefingStatus(driverId) };
}

/* ─── Сводка для администратора ──────────────────────────────────────────── */

export type QuizSummary = {
  byDriver: {
    driverId: string;
    driverLabel: string;
    attempts: number;
    passed: number;
    failed: number;
    lastAt: string | null;
    lastScore: string | null;
    averagePercent: number;
  }[];
  byTopic: { topic: string; asked: number; wrong: number; errorPercent: number }[];
  hardestQuestions: { id: string; question: string; topic: string; asked: number; wrong: number }[];
  totals: { attempts: number; passed: number; drivers: number };
};

/**
 * Сводка по тестам: кто и как сдаёт, в каких темах ошибаются чаще всего.
 * Считается из сохранённых ответов — по ним видно не только балл, но и то,
 * какой именно раздел регламента водители знают хуже.
 */
export async function getQuizSummary(): Promise<QuizSummary> {
  const byDriver = await query<{
    driver_id: string;
    driver_label: string;
    attempts: string;
    passed: string;
    last_at: string | null;
    last_score: string | null;
    average_percent: string | null;
  }>(
    `SELECT d.id AS driver_id,
            d.last_name || ' ' || d.first_name AS driver_label,
            count(a.id)::text AS attempts,
            count(a.id) FILTER (WHERE a.passed)::text AS passed,
            max(a.finished_at)::text AS last_at,
            (SELECT last.score || '/' || last.total FROM quiz_attempts last
             WHERE last.driver_id = d.id AND last.finished_at IS NOT NULL
             ORDER BY last.finished_at DESC LIMIT 1) AS last_score,
            round(avg(a.score::numeric / nullif(a.total, 0)) * 100)::text AS average_percent
     FROM drivers d
     LEFT JOIN quiz_attempts a ON a.driver_id = d.id AND a.finished_at IS NOT NULL
     WHERE d.role = 'driver'
     GROUP BY d.id, d.last_name, d.first_name
     ORDER BY d.last_name, d.first_name`
  );

  // Разворачиваем сохранённые ответы в строки «вопрос — верно/неверно».
  const perQuestion = await query<{ id: string; question: string; topic: string; asked: string; wrong: string }>(
    `WITH answered AS (
       SELECT q.id, q.question, q.topic,
              (a.answers ->> q.id::text)::int AS given,
              q.correct_index
       FROM quiz_attempts a
       CROSS JOIN LATERAL unnest(a.question_ids) AS qid
       JOIN quiz_questions q ON q.id = qid
       WHERE a.finished_at IS NOT NULL
     )
     SELECT id, question, topic,
            count(*)::text AS asked,
            count(*) FILTER (WHERE given IS DISTINCT FROM correct_index)::text AS wrong
     FROM answered
     GROUP BY id, question, topic
     ORDER BY count(*) FILTER (WHERE given IS DISTINCT FROM correct_index) DESC, count(*) DESC`
  );

  const topics = new Map<string, { asked: number; wrong: number }>();
  for (const q of perQuestion) {
    const topic = q.topic || 'Без темы';
    const acc = topics.get(topic) ?? { asked: 0, wrong: 0 };
    acc.asked += Number(q.asked);
    acc.wrong += Number(q.wrong);
    topics.set(topic, acc);
  }

  const drivers = byDriver.map((d) => ({
    driverId: d.driver_id,
    driverLabel: d.driver_label,
    attempts: Number(d.attempts),
    passed: Number(d.passed),
    failed: Number(d.attempts) - Number(d.passed),
    lastAt: d.last_at,
    lastScore: d.last_score,
    averagePercent: Number(d.average_percent ?? 0),
  }));

  return {
    byDriver: drivers,
    byTopic: [...topics.entries()]
      .map(([topic, v]) => ({
        topic,
        asked: v.asked,
        wrong: v.wrong,
        errorPercent: v.asked === 0 ? 0 : Math.round((v.wrong / v.asked) * 100),
      }))
      .sort((a, b) => b.errorPercent - a.errorPercent),
    hardestQuestions: perQuestion
      .filter((q) => Number(q.wrong) > 0)
      .slice(0, 10)
      .map((q) => ({ id: q.id, question: q.question, topic: q.topic, asked: Number(q.asked), wrong: Number(q.wrong) })),
    totals: {
      attempts: drivers.reduce((s, d) => s + d.attempts, 0),
      passed: drivers.reduce((s, d) => s + d.passed, 0),
      drivers: drivers.length,
    },
  };
}
