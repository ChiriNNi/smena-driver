import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-helpers';
import { getReportData, type ReportPeriod } from '@/lib/reports';
import { fmtKzt } from '@/lib/shared-calc';

export const dynamic = 'force-dynamic';

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",;\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function GET(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const q = req.nextUrl.searchParams;
  const period = (q.get('period') || 'all') as ReportPeriod;
  const data = await getReportData(period, q.get('from'), q.get('to'));

  const lines: string[] = [];
  const row = (...cols: unknown[]) => lines.push(cols.map(csvEscape).join(';'));

  row('Отчёт OVI', `Период: ${data.from || 'начало'} — ${data.to || 'сегодня'}`);
  row('');
  row('Сводка');
  row('Смен', data.kpi.shifts);
  row('Километры', data.kpi.km);
  row('Расходы', fmtKzt(data.kpi.expenses));
  row('Штрафы', fmtKzt(data.kpi.fines));
  row('Соблюдение чек-листов, %', data.compliance);
  row('');
  row('Статистика по водителям');
  row('Водитель', 'Смены', 'Км', 'Расходы', 'Штрафы', '% чек-листа');
  for (const d of data.byDriver) row(d.driver_name, d.shifts, d.km, d.expenses, d.fines, d.compliance);
  row('');
  row('Расходы по категориям');
  row('Категория', 'Сумма', '%');
  for (const c of data.byCategory) row(c.category, c.amount, c.percent);
  row('');
  row('Расходы по дням');
  row('Дата', 'Расходы', 'Штрафы');
  for (const d of data.daily) row(d.date, d.expenses, d.fines);
  row('');
  row('Сроки ТО и документов');
  row('Тип', 'Водитель', 'Срок', 'Статус', 'Заметка');
  const statusLabel: Record<string, string> = { ok: 'В порядке', soon: 'Скоро', over: 'Просрочено' };
  for (const r of data.reminders) row(r.type, r.driver_name || '—', r.due_date, statusLabel[r.status] || r.status, r.note || '');

  const csv = '﻿' + lines.join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ovi-report-${data.from || 'all'}_${data.to || 'now'}.csv"`,
    },
  });
}
