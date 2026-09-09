import { NextRequest } from 'next/server';
import { query, queryOne, withTransaction } from '@/lib/db';
import {
  ApiError,
  dateISO,
  num,
  ok,
  readBody,
  str,
  timeHHMM,
  todayISO,
  uuid,
  withUser,
} from '@/lib/api-helpers';
import { getBriefingStatus } from '@/lib/briefing';
import { buildShiftSummary } from '@/lib/report-text';
import { carLabel, driverLabel, toShift, type ShiftRemark, type ShiftRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

const SHIFT_FIELDS = `id, driver_id, car_id, driver_label, car_label, date_iso::text AS date_iso,
  time_start, time_end, place_start, place_end,
  cash_start, cash_end, cash_expenses, cash_fines, odo_start, odo_end,
  checklist_done, checklist_total`;

/* ─── История смен ───────────────────────────────────────────────────────── */

// Водитель видит только свои смены — фильтр по driverId для него игнорируется,
// иначе подстановкой чужого id можно было бы прочитать чужую историю.
export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const q = req.nextUrl.searchParams;
    const conditions: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      conditions.push(sql.replace('$?', `$${params.length}`));
    };

    if (user.role === 'admin') {
      const driverId = uuid(q.get('driverId'), 'водитель');
      const carId = uuid(q.get('carId'), 'автомобиль');
      if (driverId) add('s.driver_id = $?', driverId);
      if (carId) add('s.car_id = $?', carId);
    } else {
      add('s.driver_id = $?', user.id);
    }

    const from = q.get('from');
    const to = q.get('to');
    if (from) add('s.date_iso >= $?', from);
    if (to) add('s.date_iso <= $?', to);

    const search = q.get('q')?.trim();
    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      conditions.push(
        `(s.driver_label ILIKE ${p} OR s.car_label ILIKE ${p} OR s.place_start ILIKE ${p} OR s.place_end ILIKE ${p})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(q.get('limit')) || 200, 1), 1000);

    const rows = await query<ShiftRow>(
      `SELECT ${SHIFT_FIELDS} FROM shifts s ${where} ORDER BY s.date_iso DESC, s.created_at DESC LIMIT ${limit}`,
      params
    );

    // Замечания подтягиваем одним запросом на всю страницу истории — иначе
    // на каждую смену уходил бы отдельный запрос (N+1).
    const ids = rows.map((r) => r.id);
    const remarks = new Map<string, ShiftRemark[]>();
    if (ids.length > 0) {
      const items = await query<{ shift_id: string; item_text: string; comment: string | null; photos: number }>(
        `SELECT shift_id, item_text, comment, coalesce(array_length(photo_paths, 1), 0) AS photos
         FROM shift_items
         WHERE shift_id = ANY($1::uuid[]) AND (coalesce(comment, '') <> '' OR coalesce(array_length(photo_paths, 1), 0) > 0)
         ORDER BY position`,
        [ids]
      );
      for (const i of items) {
        const list = remarks.get(i.shift_id) ?? [];
        list.push({ text: i.item_text, comment: i.comment ?? '', photos: Number(i.photos) || 0 });
        remarks.set(i.shift_id, list);
      }
    }

    return ok({ shifts: rows.map((r) => toShift(r, remarks.get(r.id) ?? [])) });
  });
}

/* ─── Завершение смены ──────────────────────────────────────────────────── */

type ItemInput = {
  phase: string;
  sectionTitle: string;
  text: string;
  checked: boolean;
  comment: string;
  photoPaths: string[];
};

/** Разбор снимка чек-листа. Фото проверяем на принадлежность водителю. */
function parseItems(raw: unknown, driverId: string): ItemInput[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ApiError('Чек-лист смены пуст.');

  return raw.map((entry) => {
    const item = entry as Record<string, unknown>;
    const text = String(item.text ?? '').trim();
    if (!text) throw new ApiError('В чек-листе есть пункт без текста.');

    const photosRaw = Array.isArray(item.photoPaths) ? item.photoPaths.map(String) : [];
    // Путь в бакете начинается с id водителя (см. buildPhotoPath). Так чужой
    // файл нельзя приложить к своей смене, подставив его путь в запрос.
    const photoPaths = photosRaw.filter((p) => p.startsWith(`${driverId}/`));
    if (photoPaths.length !== photosRaw.length) throw new ApiError('Фото не принадлежит этой смене.', 403);

    return {
      phase: String(item.phase ?? ''),
      sectionTitle: String(item.sectionTitle ?? ''),
      text,
      checked: Boolean(item.checked),
      comment: String(item.comment ?? '').trim(),
      photoPaths,
    };
  });
}

export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    if (user.role !== 'driver') throw new ApiError('Смену закрывает водитель со своего аккаунта.', 403);

    // Тот же барьер, что и в интерфейсе: без действующего допуска по ТБ смена
    // не закрывается. На клиенте проверка нужна для удобства, здесь — по факту.
    const briefing = await getBriefingStatus(user.id);
    if (!briefing.valid) throw new ApiError('Нет действующего допуска по ТБ — сначала пройдите инструктаж.', 403);

    const body = await readBody(req);
    const clientRequestId = str(body, 'clientRequestId', { required: true, max: 64 });

    // Повторная отправка того же завершения (двойной тап, ретрай на плохой
    // связи) не создаёт вторую смену, а возвращает уже записанную.
    const existing = await queryOne<ShiftRow>(
      `SELECT ${SHIFT_FIELDS} FROM shifts WHERE client_request_id = $1 AND driver_id = $2`,
      [clientRequestId, user.id]
    );
    if (existing) return ok({ shift: toShift(existing), duplicate: true });

    const carId = uuid(str(body, 'carId') || null, 'автомобиль', { required: true })!;
    const car = await queryOne<{ model: string; plate: string }>('SELECT model, plate FROM cars WHERE id = $1', [carId]);
    if (!car) throw new ApiError('Автомобиль не найден.', 404);

    const items = parseItems(body.items, user.id);
    const done = items.filter((i) => i.checked).length;

    const shiftData = {
      driverLabel: driverLabel(user),
      carLabel: carLabel(car),
      date: dateISO(body, 'date') || todayISO(),
      timeStart: timeHHMM(body, 'timeStart'),
      timeEnd: timeHHMM(body, 'timeEnd'),
      placeStart: str(body, 'placeStart', { max: 200 }),
      placeEnd: str(body, 'placeEnd', { max: 200 }),
      cashStart: num(body, 'cashStart', { min: 0 }),
      cashEnd: num(body, 'cashEnd', { min: 0 }),
      cashExpenses: num(body, 'cashExpenses', { min: 0 }),
      cashFines: num(body, 'cashFines', { min: 0 }),
      odoStart: num(body, 'odoStart', { min: 0 }),
      odoEnd: num(body, 'odoEnd', { min: 0 }),
      done,
      total: items.length,
    };

    if (shiftData.odoEnd && shiftData.odoEnd < shiftData.odoStart) {
      throw new ApiError('Одометр на конец смены меньше, чем на начало — проверьте показания.');
    }

    const remarks: ShiftRemark[] = items
      .filter((i) => i.comment || i.photoPaths.length > 0)
      .map((i) => ({ text: i.text, comment: i.comment, photos: i.photoPaths.length }));

    const summary = buildShiftSummary({ ...shiftData, remarks });

    // Смена, её снимок чек-листа и очистка черновика — одной транзакцией:
    // иначе при обрыве связи можно получить смену без пунктов или живой
    // черновик поверх уже закрытой смены.
    const shift = await withTransaction(async (tx) => {
      const [row] = await tx.query<ShiftRow>(
        `INSERT INTO shifts (
           driver_id, car_id, driver_label, car_label, date_iso,
           time_start, time_end, place_start, place_end,
           cash_start, cash_end, cash_expenses, cash_fines, odo_start, odo_end,
           checklist_done, checklist_total, summary_text, client_request_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING ${SHIFT_FIELDS}`,
        [
          user.id,
          carId,
          shiftData.driverLabel,
          shiftData.carLabel,
          shiftData.date,
          shiftData.timeStart,
          shiftData.timeEnd,
          shiftData.placeStart,
          shiftData.placeEnd,
          shiftData.cashStart,
          shiftData.cashEnd,
          shiftData.cashExpenses,
          shiftData.cashFines,
          shiftData.odoStart,
          shiftData.odoEnd,
          shiftData.done,
          shiftData.total,
          summary,
          clientRequestId,
        ]
      );

      // Один многострочный INSERT вместо 60 отдельных: пунктов в чек-листе
      // десятки, а соединение у водителя мобильное.
      const values: unknown[] = [];
      const tuples = items.map((item, i) => {
        values.push(row.id, item.phase, item.sectionTitle, item.text, i, item.checked, item.comment || null, item.photoPaths);
        const base = i * 8;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}::text[])`;
      });
      await tx.query(
        `INSERT INTO shift_items (shift_id, phase, section_title, item_text, position, checked, comment, photo_paths)
         VALUES ${tuples.join(', ')}`,
        values
      );

      await tx.query('DELETE FROM shift_drafts WHERE driver_id = $1', [user.id]);
      return row;
    });

    return ok({ shift: toShift(shift, remarks), summary });
  });
}
