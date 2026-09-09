import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, readBody, str, withAdmin, withUser } from '@/lib/api-helpers';
import { toRule, type RuleRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

// Свод правил и техники безопасности: водитель читает его перед тестом,
// администратор правит из настроек.

export async function GET() {
  return withUser(async () => {
    const rows = await query<RuleRow>('SELECT id, title, body FROM rules WHERE active ORDER BY position, title');
    return ok({ rules: rows.map(toRule) });
  });
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);
    // Новый пункт становится последним — порядок правил осмысленный, а не алфавитный.
    const row = await queryOne<RuleRow>(
      `INSERT INTO rules (title, body, position)
       VALUES ($1, $2, (SELECT coalesce(max(position), -1) + 1 FROM rules))
       RETURNING id, title, body`,
      [str(body, 'title', { required: true, max: 200 }), str(body, 'body', { max: 4000 })]
    );
    if (!row) throw new ApiError('Не удалось добавить правило.', 500);
    return ok({ rule: toRule(row) });
  });
}
