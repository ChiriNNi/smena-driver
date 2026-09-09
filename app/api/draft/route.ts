import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, withUser } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// Черновик текущей смены: отметки чек-листа, замечания, данные начала смены.
// Водитель работает по 12 часов и открывает приложение десятки раз — потерять
// прогресс из-за перезагрузки страницы или разряженного телефона нельзя.
//
// Черновик всегда принадлежит тому, кто его запрашивает: id водителя берётся
// из сессии, а не из тела запроса, поэтому чужой черновик недоступен.

const MAX_DRAFT_BYTES = 512 * 1024;

export async function GET() {
  return withUser(async (user) => {
    const row = await queryOne<{ data: unknown; updated_at: string }>(
      'SELECT data, updated_at FROM shift_drafts WHERE driver_id = $1',
      [user.id]
    );
    return ok({ draft: row?.data ?? null, updatedAt: row?.updated_at ?? null });
  });
}

/**
 * Полная перезапись черновика. Клиент сохраняет с задержкой (debounce), так
 * что запросов немного, а разбирать частичные патчи в JSONB не нужно.
 */
export async function PUT(req: NextRequest) {
  return withUser(async (user) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ApiError('Некорректный запрос: ожидался JSON.');

    const serialized = JSON.stringify(body);
    // Ограничение по размеру: в черновике должны быть отметки и короткие
    // комментарии. Фото хранятся в Storage, в JSON попадают только их пути.
    if (Buffer.byteLength(serialized, 'utf8') > MAX_DRAFT_BYTES) {
      throw new ApiError('Черновик слишком большой.', 413);
    }

    const row = await queryOne<{ updated_at: string }>(
      `INSERT INTO shift_drafts (driver_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (driver_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING updated_at`,
      [user.id, serialized]
    );

    return ok({ ok: true, updatedAt: row?.updated_at ?? null });
  });
}

/** Сброс смены до её завершения — водитель начинает заново. */
export async function DELETE() {
  return withUser(async (user) => {
    await query('DELETE FROM shift_drafts WHERE driver_id = $1', [user.id]);
    return ok({ ok: true });
  });
}
