import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-helpers';
import { cashDiscrepancy, complianceOf } from '@/lib/shared-calc';

export const dynamic = 'force-dynamic';

type ShiftRow = {
  id: string;
  driver_id: string | null;
  driver_name_cache: string | null;
  date_iso: string;
  time_start: string | null;
  time_end: string | null;
  place_start: string | null;
  place_end: string | null;
  cars: string[];
  cash_start: string | null;
  cash_end: string | null;
  cash_expenses: string | null;
  cash_fines: string | null;
  checklist_done: number;
  checklist_total: number;
  summary_text: string | null;
  created_at: string;
};

// ── GET: история смен, с фильтрами (доступно и водителю, и администратору — только чтение) ──
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const driverId = q.get('driverId');
  const from = q.get('from');
  const to = q.get('to');
  const search = q.get('q');

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (driverId) { params.push(driverId); conditions.push(`s.driver_id = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`s.date_iso >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`s.date_iso <= $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    const p = params.length;
    conditions.push(
      `(s.driver_name_cache ILIKE $${p} OR s.place_start ILIKE $${p} OR s.place_end ILIKE $${p} OR array_to_string(s.cars, ', ') ILIKE $${p})`
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query<ShiftRow>(
    `SELECT s.* FROM shifts s ${where} ORDER BY s.date_iso DESC, s.created_at DESC LIMIT 500`,
    params
  );

  const shifts = rows.map((s) => {
    const discrepancy = cashDiscrepancy(Number(s.cash_start) || 0, Number(s.cash_end) || 0, Number(s.cash_expenses) || 0);
    return { ...s, discrepancy, compliance: complianceOf(s.checklist_done, s.checklist_total) };
  });

  return NextResponse.json({ shifts });
}

type FinishItem = { phase: string; section: string; itemKey: string; checked: boolean; noteText?: string; photoUrls?: string[] };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Некорректное тело запроса.');

  const clientRequestId: string = String(body.clientRequestId || '');
  if (!clientRequestId) return jsonError('Не передан clientRequestId (нужен для защиты от двойной отправки).');

  // Идемпотентность: если смена с таким clientRequestId уже была принята — вернуть её же, не создавая дубль.
  const existing = await queryOne<ShiftRow>('SELECT * FROM shifts WHERE client_request_id = $1', [clientRequestId]);
  if (existing) {
    return NextResponse.json({ shift: existing, alreadyProcessed: true, syncMsgs: [] });
  }

  const driverId: string | null = body.driverId || null;
  // Имя резолвится на сервере по driverId (а не берётся из тела запроса) — так driver_name_cache
  // остаётся верным, даже если клиент прислал рассинхронизированное состояние.
  let driverName: string = String(body.driverName || '');
  if (driverId) {
    const d = await queryOne<{ name: string }>('SELECT name FROM drivers WHERE id = $1', [driverId]);
    if (d) driverName = d.name;
  }
  const dateISO: string = body.date || new Date().toISOString().slice(0, 10);
  const cars: string[] = Array.isArray(body.cars) ? body.cars : [];
  const cashStart = Number(body.cashStart) || 0;
  const cashEnd = Number(body.cashEnd) || 0;
  const cashExpenses = Number(body.cashExpenses) || 0;
  const cashFines = Number(body.cashFines) || 0;
  const items: FinishItem[] = Array.isArray(body.checklistItems) ? body.checklistItems : [];
  const odometers: Record<string, { start?: string | number; end?: string | number }> = body.odometers || {};

  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  const summaryText: string = String(body.summaryText || '');

  const result = await withTransaction(async (client) => {
    const [shift] = await client.query<ShiftRow>(
      `INSERT INTO shifts
        (driver_id, driver_name_cache, date_iso, time_start, time_end, place_start, place_end, cars,
         cash_start, cash_end, cash_expenses, cash_fines, checklist_done, checklist_total, summary_text, client_request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        driverId, driverName, dateISO, body.timeStart || null, body.timeEnd || null,
        body.placeStart || null, body.placeEnd || null, cars,
        cashStart, cashEnd, cashExpenses, cashFines, done, total, summaryText, clientRequestId,
      ]
    );

    for (const it of items) {
      await client.query(
        `INSERT INTO checklist_items (shift_id, phase, section, item_key, checked, note_text, photo_urls)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [shift.id, it.phase, it.section, it.itemKey, it.checked, it.noteText || null, it.photoUrls || []]
      );
    }

    const syncMsgs: string[] = [];

    // Пробег → журнал пробега, отдельная запись по каждой машине
    let totalKm = 0;
    for (const car of cars) {
      const o = odometers[car] || {};
      const os = Number(o.start);
      const oe = Number(o.end);
      if (Number.isFinite(os) && Number.isFinite(oe) && oe >= os && oe - os > 0) {
        await client.query(
          `INSERT INTO mileage (driver_id, shift_id, car, odo_start, odo_end, date_iso) VALUES ($1,$2,$3,$4,$5,$6)`,
          [driverId, shift.id, car, os, oe, dateISO]
        );
        totalKm += oe - os;
      }
    }
    if (totalKm > 0) syncMsgs.push(`пробег ${totalKm.toLocaleString('ru-RU')} км`);

    if (cashExpenses > 0) {
      await client.query(
        `INSERT INTO expenses (driver_id, shift_id, category, amount, title, date_iso) VALUES ($1,$2,'Прочее',$3,'Расходы за смену',$4)`,
        [driverId, shift.id, cashExpenses, dateISO]
      );
      syncMsgs.push(`расход ${cashExpenses.toLocaleString('ru-RU')} ₸`);
    }
    if (cashFines > 0) {
      await client.query(
        `INSERT INTO expenses (driver_id, shift_id, category, amount, title, date_iso) VALUES ($1,$2,'Штраф',$3,'Штраф за смену',$4)`,
        [driverId, shift.id, cashFines, dateISO]
      );
      syncMsgs.push(`штраф ${cashFines.toLocaleString('ru-RU')} ₸`);
    }

    if (body.timeStart || body.timeEnd) {
      await client.query(
        `INSERT INTO schedule (driver_id, date_iso, time_start, time_end, car, note) VALUES ($1,$2,$3,$4,$5,'Смена (из чек-листа)')`,
        [driverId, dateISO, body.timeStart || null, body.timeEnd || null, cars[0] || null]
      );
    }

    if (driverId) {
      await client.query('DELETE FROM draft_shift WHERE driver_id = $1', [driverId]);
    }

    return { shift, syncMsgs };
  });

  return NextResponse.json({ shift: result.shift, syncMsgs: result.syncMsgs, alreadyProcessed: false });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return jsonError('Не указан id.');
  await query('DELETE FROM shifts WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
