import { NextRequest } from 'next/server';
import { ok, readBody, str, uuid, withUser } from '@/lib/api-helpers';
import { signAttempt } from '@/lib/briefing';

export const dynamic = 'force-dynamic';

/**
 * Подпись об ознакомлении с регламентом. Ставится после сданного теста;
 * ФИО подставляет сервер из профиля — вводить его руками не нужно, а подделать
 * чужую подпись через запрос нельзя.
 */
export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    const body = await readBody(req);
    const attemptId = uuid(str(body, 'attemptId', { required: true }), 'попытка', { required: true })!;
    return ok({ briefing: await signAttempt(user.id, attemptId) });
  });
}
