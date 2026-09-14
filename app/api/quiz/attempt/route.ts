import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { ApiError, ok, readBody, str, uuid, withAdmin, withUser } from '@/lib/api-helpers';
import { startAttempt, submitAttempt } from '@/lib/briefing';
import { toAttempt, type QuizAttemptRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

/**
 * Начало попытки: сервер выбирает вопросы случайно и запоминает набор.
 * Ответы приходят следующим запросом (PUT) — считаются только по этому набору.
 */
export async function POST() {
  return withUser(async (user) => {
    return ok(await startAttempt(user.id));
  });
}

/** Отправка ответов: { attemptId, answers: { [questionId]: индекс } }. */
export async function PUT(req: NextRequest) {
  return withUser(async (user) => {
    const body = await readBody(req);
    const attemptId = uuid(str(body, 'attemptId', { required: true }), 'попытка', { required: true })!;

    const raw = body.answers;
    if (!raw || typeof raw !== 'object') throw new ApiError('Не переданы ответы.');

    const answers: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const index = Number(value);
      if (Number.isInteger(index) && index >= 0) answers[key] = index;
    }

    return ok(await submitAttempt(user.id, attemptId, answers));
  });
}

/** Журнал ознакомления: последняя завершённая попытка каждого водителя. */
export async function GET() {
  return withAdmin(async () => {
    const rows = await query<QuizAttemptRow>(
      `SELECT DISTINCT ON (driver_id) id, driver_id, date_iso::text AS date_iso, score, total, passed
       FROM quiz_attempts WHERE finished_at IS NOT NULL
       ORDER BY driver_id, finished_at DESC`
    );
    return ok({ attempts: rows.map(toAttempt) });
  });
}
