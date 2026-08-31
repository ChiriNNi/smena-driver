import { NextResponse } from 'next/server';
import { publicQuiz } from '@/lib/quiz-data.server';

export const dynamic = 'force-dynamic';

// Отдаёт вопросы и варианты БЕЗ правильных ответов — сам ответ проверяется на сервере в /api/rules/ack.
export async function GET() {
  return NextResponse.json({ quiz: publicQuiz() });
}
