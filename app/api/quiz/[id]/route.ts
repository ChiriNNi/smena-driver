import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, readBody, str, uuid, withAdmin } from '@/lib/api-helpers';
import { toQuizAdmin, type QuizRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'вопрос', { required: true });
    const body = await readBody(req);

    const question = str(body, 'question', { required: true, max: 500 });
    const options = (Array.isArray(body.options) ? body.options : []).map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2) throw new ApiError('Нужно минимум два варианта ответа.');

    const correct = Number(body.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      throw new ApiError('Укажите, какой из вариантов правильный.');
    }

    const row = await queryOne<QuizRow>(
      `UPDATE quiz_questions SET question = $1, options = $2::text[], correct_index = $3
       WHERE id = $4 AND active RETURNING id, question, options, correct_index`,
      [question, options, correct, id]
    );
    if (!row) throw new ApiError('Вопрос не найден.', 404);
    return ok({ question: toQuizAdmin(row) });
  });
}

/**
 * Удаление вопроса — флагом active: попытки в журнале хранят счёт «3 из 3»,
 * и число вопросов на момент проверки должно оставаться восстановимым.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    uuid(id, 'вопрос', { required: true });
    await query('UPDATE quiz_questions SET active = false WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
