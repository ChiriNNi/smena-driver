import { query } from './db';
import { complianceOf, reminderStatus } from './shared-calc';

export type ReportPeriod = 'all' | 'month' | '30d' | '7d' | 'custom';

export function periodRange(period: ReportPeriod, from?: string | null, to?: string | null): { from: string | null; to: string | null } {
  if (period === 'custom') return { from: from || null, to: to || null };
  const today = new Date();
  const toISO = today.toISOString().slice(0, 10);
  if (period === 'all') return { from: null, to: null };
  if (period === '7d') {
    const d = new Date(today); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: toISO };
  }
  if (period === '30d') {
    const d = new Date(today); d.setDate(d.getDate() - 29);
    return { from: d.toISOString().slice(0, 10), to: toISO };
  }
  // month
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: first.toISOString().slice(0, 10), to: toISO };
}

function dateCond(alias: string, from: string | null, to: string | null, params: unknown[]): string {
  const parts: string[] = [];
  if (from) { params.push(from); parts.push(`${alias}.date_iso >= $${params.length}`); }
  if (to) { params.push(to); parts.push(`${alias}.date_iso <= $${params.length}`); }
  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

export type DriverStat = {
  driver_id: string | null;
  driver_name: string;
  shifts: number;
  km: number;
  expenses: number;
  fines: number;
  compliance: number;
};

export type ReportData = {
  from: string | null;
  to: string | null;
  kpi: { shifts: number; km: number; expenses: number; fines: number };
  compliance: number;
  daily: { date: string; expenses: number; fines: number }[];
  byDriver: DriverStat[];
  byCategory: { category: string; amount: number; percent: number }[];
  reminders: { id: string; type: string; due_date: string; note: string | null; driver_name: string | null; status: string }[];
};

export async function getReportData(period: ReportPeriod, fromIn?: string | null, toIn?: string | null): Promise<ReportData> {
  const { from, to } = periodRange(period, fromIn, toIn);

  const shiftParams: unknown[] = [];
  const shiftWhere = dateCond('s', from, to, shiftParams);
  const shiftsAgg = await query<{ cnt: string; done: string; total: string }>(
    `SELECT COUNT(*)::text AS cnt, COALESCE(SUM(checklist_done),0)::text AS done, COALESCE(SUM(checklist_total),0)::text AS total
     FROM shifts s ${shiftWhere}`,
    shiftParams
  );

  const mileageParams: unknown[] = [];
  const mileageWhere = dateCond('m', from, to, mileageParams);
  const kmAgg = await query<{ km: string }>(
    `SELECT COALESCE(SUM(odo_end - odo_start),0)::text AS km FROM mileage m ${mileageWhere}`,
    mileageParams
  );

  const expParams: unknown[] = [];
  const expWhere = dateCond('e', from, to, expParams);
  const expByCat = await query<{ category: string; amount: string }>(
    `SELECT category, COALESCE(SUM(amount),0)::text AS amount FROM expenses e ${expWhere} GROUP BY category`,
    expParams
  );
  const expensesSum = expByCat.filter((c) => c.category !== 'Штраф').reduce((s, c) => s + Number(c.amount), 0);
  const finesSum = expByCat.filter((c) => c.category === 'Штраф').reduce((s, c) => s + Number(c.amount), 0);
  const catTotal = expensesSum + finesSum;
  const byCategory = expByCat
    .map((c) => ({ category: c.category, amount: Number(c.amount), percent: catTotal ? Math.round((Number(c.amount) / catTotal) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const dailyParams: unknown[] = [];
  const dailyWhere = dateCond('e', from, to, dailyParams);
  const daily = await query<{ date_iso: string; expenses: string; fines: string }>(
    `SELECT date_iso,
            COALESCE(SUM(amount) FILTER (WHERE category <> 'Штраф'),0)::text AS expenses,
            COALESCE(SUM(amount) FILTER (WHERE category = 'Штраф'),0)::text AS fines
     FROM expenses e ${dailyWhere} GROUP BY date_iso ORDER BY date_iso ASC`,
    dailyParams
  );

  // По водителям — LEFT JOIN drivers, чтобы посчитать и записи без привязки (driver_id IS NULL) отдельно не показываем,
  // группируем по driver_id, но используем cache-имя смены для устойчивости к удалению профиля.
  const byDriverParams: unknown[] = [];
  const shiftDW = dateCond('s', from, to, byDriverParams);
  const shiftsByDriver = await query<{ driver_id: string | null; driver_name: string; cnt: string; done: string; total: string }>(
    `SELECT s.driver_id, COALESCE(d.name, s.driver_name_cache, 'Без привязки') AS driver_name,
            COUNT(*)::text AS cnt, COALESCE(SUM(s.checklist_done),0)::text AS done, COALESCE(SUM(s.checklist_total),0)::text AS total
     FROM shifts s LEFT JOIN drivers d ON d.id = s.driver_id
     ${shiftDW}
     GROUP BY s.driver_id, COALESCE(d.name, s.driver_name_cache, 'Без привязки')`,
    byDriverParams
  );

  const kmByDriverParams: unknown[] = [];
  const mileageDW = dateCond('m', from, to, kmByDriverParams);
  const kmByDriver = await query<{ driver_id: string | null; km: string }>(
    `SELECT m.driver_id, COALESCE(SUM(m.odo_end - m.odo_start),0)::text AS km FROM mileage m ${mileageDW} GROUP BY m.driver_id`,
    kmByDriverParams
  );

  const expByDriverParams: unknown[] = [];
  const expDW = dateCond('e', from, to, expByDriverParams);
  const expByDriver = await query<{ driver_id: string | null; expenses: string; fines: string }>(
    `SELECT e.driver_id,
            COALESCE(SUM(amount) FILTER (WHERE category <> 'Штраф'),0)::text AS expenses,
            COALESCE(SUM(amount) FILTER (WHERE category = 'Штраф'),0)::text AS fines
     FROM expenses e ${expDW} GROUP BY e.driver_id`,
    expByDriverParams
  );

  const kmMap = new Map(kmByDriver.map((r) => [r.driver_id, Number(r.km)]));
  const expMap = new Map(expByDriver.map((r) => [r.driver_id, { expenses: Number(r.expenses), fines: Number(r.fines) }]));

  const byDriver: DriverStat[] = shiftsByDriver.map((r) => ({
    driver_id: r.driver_id,
    driver_name: r.driver_name,
    shifts: Number(r.cnt),
    km: kmMap.get(r.driver_id) || 0,
    expenses: expMap.get(r.driver_id)?.expenses || 0,
    fines: expMap.get(r.driver_id)?.fines || 0,
    compliance: complianceOf(Number(r.done), Number(r.total)),
  })).sort((a, b) => b.shifts - a.shifts);

  const remindersRaw = await query<{ id: string; type: string; due_date: string; note: string | null; driver_name: string | null }>(
    `SELECT r.id, r.type, r.due_date::text, r.note, d.name AS driver_name FROM reminders r LEFT JOIN drivers d ON d.id = r.driver_id ORDER BY r.due_date ASC`
  );
  const reminders = remindersRaw.map((r) => ({ ...r, status: reminderStatus(r.due_date) }));

  const agg = shiftsAgg[0] || { cnt: '0', done: '0', total: '0' };

  return {
    from, to,
    kpi: { shifts: Number(agg.cnt), km: Number(kmAgg[0]?.km || 0), expenses: expensesSum, fines: finesSum },
    compliance: complianceOf(Number(agg.done), Number(agg.total)),
    daily: daily.map((d) => ({ date: d.date_iso, expenses: Number(d.expenses), fines: Number(d.fines) })),
    byDriver,
    byCategory,
    reminders,
  };
}
