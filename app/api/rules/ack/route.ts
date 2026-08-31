import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonError } from '@/lib/api-helpers';
import { scoreQuiz } from '@/lib/quiz-data.server';

export const dynamic = 'force-dynamic';

// Тест и подпись проверяются и сохраняются одним атомарным запросом — в отличие от исходной
// версии, где результат теста хранился в незащищённой глобальной переменной браузера
// и мог быть подделан через консоль (window._lastQuizPass = true).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const driverName = String(b?.driverName || '').trim();
  const answers: number[] = Array.isArray(b?.answers) ? b.answers : [];
  if (!driverName) return jsonError('Укажите ФИО.');

  const { score, total, passed } = scoreQuiz(answers);
  if (!passed) {
    return NextResponse.json({ score, total, passed, saved: false });
  }

  const row = await queryOne(
    `INSERT INTO rule_acks (driver_name, quiz_score, quiz_total, passed) VALUES ($1,$2,$3,true) RETURNING id, signed_at`,
    [driverName, score, total]
  );
  return NextResponse.json({ score, total, passed: true, saved: true, ack: row });
}
