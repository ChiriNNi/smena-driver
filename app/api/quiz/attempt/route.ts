import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { ApiError, ok, readBody, withAdmin, withUser } from '@/lib/api-helpers';
import { scoreAttempt } from '@/lib/briefing';
import { toAttempt, type QuizAttemptRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

/**
 * Попытка прохождения теста. Ответы приходят как { [questionId]: индекс },
 * проверяются на сервере, попытка записывается с любым результатом — в журнале
 * администратора должны быть видны и неудачные.
 */
export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    const body = await readBody(req);
    const raw = body.answers;
    if (!raw || typeof raw !== 'object') throw new ApiError('Не переданы ответы.');

    const answers: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const index = Number(value);
      if (Number.isInteger(index) && index >= 0) answers[key] = index;
    }

    return ok(await scoreAttempt(user.id, answers));
  });
}

/** Журнал ознакомления: последняя попытка каждого водителя — для админки. */
export async function GET() {
  return withAdmin(async () => {
    const rows = await query<QuizAttemptRow>(
      `SELECT DISTINCT ON (driver_id) id, driver_id, date_iso::text AS date_iso, score, total, passed
       FROM quiz_attempts ORDER BY driver_id, created_at DESC`
    );
    return ok({ attempts: rows.map(toAttempt) });
  });
}
