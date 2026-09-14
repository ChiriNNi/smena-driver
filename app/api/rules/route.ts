import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, readBody, str, withAdmin, withUser } from '@/lib/api-helpers';
import { toRule, type RuleRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, kind, title, subtitle, body, points';

// Регламенты: обязанности и правила. Водитель читает их в кабинете и перед
// тестом по ТБ, администратор правит из настроек.

export async function GET() {
  return withUser(async () => {
    // Порядок фиксированный: сначала обязанности, потом правила, внутри — по position.
    const rows = await query<RuleRow>(
      `SELECT ${FIELDS} FROM rules WHERE active
       ORDER BY CASE kind WHEN 'duty' THEN 0 ELSE 1 END, position, title`
    );
    return ok({ rules: rows.map(toRule) });
  });
}

/** Пункты приходят списком строк; пустые строки отбрасываем. */
export function parsePoints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => String(p).trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);
    const kind = str(body, 'kind') === 'duty' ? 'duty' : 'rule';
    const points = parsePoints(body.points);
    if (points.length === 0) throw new ApiError('Добавьте хотя бы один пункт.');

    // Новый блок встаёт последним среди своего вида — порядок регламента
    // осмысленный, а не алфавитный.
    const row = await queryOne<RuleRow>(
      `INSERT INTO rules (kind, title, subtitle, body, points, position)
       VALUES ($1, $2, $3, $4, $5::text[], (SELECT coalesce(max(position), -1) + 1 FROM rules WHERE kind = $1))
       RETURNING ${FIELDS}`,
      [
        kind,
        str(body, 'title', { required: true, max: 200 }),
        str(body, 'subtitle', { max: 80 }),
        str(body, 'body', { max: 4000 }),
        points,
      ]
    );
    if (!row) throw new ApiError('Не удалось добавить блок регламента.', 500);
    return ok({ rule: toRule(row) });
  });
}
