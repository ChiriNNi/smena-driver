import { NextRequest, NextResponse } from 'next/server';
import { scoreQuiz } from '@/lib/quiz-data.server';

export const dynamic = 'force-dynamic';

// Проверка результата теста БЕЗ сохранения подписи (для кнопки "Проверить тест").
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const answers: number[] = Array.isArray(b?.answers) ? b.answers : [];
  const result = scoreQuiz(answers);
  return NextResponse.json(result);
}
