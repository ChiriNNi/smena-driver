import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, readBody, str, withAdmin, withUser } from '@/lib/api-helpers';
import { toQuizAdmin, toQuizPublic, type QuizRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

// Банк вопросов теста по ТБ.
//
// Этот маршрут — для редактора администратора: он отдаёт весь банк.
// Водитель вопросы отсюда не берёт, ему случайную выборку выдаёт
// POST /api/quiz/attempt — иначе по списку было бы видно все вопросы сразу,
// а правильный ответ администратору нужен, водителю нет.

export async function GET() {
  return withUser(async (user) => {
    const rows = await query<QuizRow>(
      'SELECT id, question, options, correct_index, topic FROM quiz_questions WHERE active ORDER BY position, question'
    );
    return user.role === 'admin'
      ? ok({ quiz: rows.map(toQuizAdmin) })
      : ok({ quiz: rows.map(toQuizPublic) });
  });
}

/** Разбор вопроса из тела запроса: варианты и индекс правильного ответа. */
function parseQuestion(body: Record<string, unknown>) {
  const question = str(body, 'question', { required: true, max: 500 });
  const topic = str(body, 'topic', { max: 60 });
  const options = (Array.isArray(body.options) ? body.options : [])
    .map((o) => String(o).trim())
    .filter(Boolean);
  if (options.length < 2) throw new ApiError('Нужно минимум два варианта ответа.');

  const correct = Number(body.correct);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    throw new ApiError('Укажите, какой из вариантов правильный.');
  }
  return { question, options, correct, topic };
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const { question, options, correct, topic } = parseQuestion(await readBody(req));
    const row = await queryOne<QuizRow>(
      `INSERT INTO quiz_questions (question, options, correct_index, topic, position)
       VALUES ($1, $2::text[], $3, $4, (SELECT coalesce(max(position), -1) + 1 FROM quiz_questions))
       RETURNING id, question, options, correct_index, topic`,
      [question, options, correct, topic]
    );
    if (!row) throw new ApiError('Не удалось добавить вопрос.', 500);
    return ok({ question: toQuizAdmin(row) });
  });
}
