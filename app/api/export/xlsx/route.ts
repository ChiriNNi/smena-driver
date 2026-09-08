import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/api-helpers';
import { getReportData, type ReportPeriod } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = { ok: 'В порядке', soon: 'Скоро', over: 'Просрочено' };

export async function GET(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const q = req.nextUrl.searchParams;
  const period = (q.get('period') || 'all') as ReportPeriod;
  const data = await getReportData(period, q.get('from'), q.get('to'));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smena';
  wb.created = new Date();

  const summary = wb.addWorksheet('Сводка');
  summary.columns = [{ width: 28 }, { width: 20 }];
  summary.addRow(['Отчёт Smena', `Период: ${data.from || 'начало'} — ${data.to || 'сегодня'}`]).font = { bold: true };
  summary.addRow([]);
  summary.addRow(['Смен', data.kpi.shifts]);
  summary.addRow(['Километры', data.kpi.km]);
  summary.addRow(['Расходы, ₸', data.kpi.expenses]);
  summary.addRow(['Штрафы, ₸', data.kpi.fines]);
  summary.addRow(['Соблюдение чек-листов, %', data.compliance]);

  const drivers = wb.addWorksheet('Водители');
  drivers.columns = [
    { header: 'Водитель', key: 'driver_name', width: 26 },
    { header: 'Смены', key: 'shifts', width: 10 },
    { header: 'Км', key: 'km', width: 12 },
    { header: 'Расходы, ₸', key: 'expenses', width: 14 },
    { header: 'Штрафы, ₸', key: 'fines', width: 12 },
    { header: '% чек-листа', key: 'compliance', width: 12 },
  ];
  drivers.getRow(1).font = { bold: true };
  data.byDriver.forEach((d) => drivers.addRow(d));

  const categories = wb.addWorksheet('Категории расходов');
  categories.columns = [
    { header: 'Категория', key: 'category', width: 24 },
    { header: 'Сумма, ₸', key: 'amount', width: 14 },
    { header: '%', key: 'percent', width: 8 },
  ];
  categories.getRow(1).font = { bold: true };
  data.byCategory.forEach((c) => categories.addRow(c));

  const dailySheet = wb.addWorksheet('По дням');
  dailySheet.columns = [
    { header: 'Дата', key: 'date', width: 14 },
    { header: 'Расходы, ₸', key: 'expenses', width: 14 },
    { header: 'Штрафы, ₸', key: 'fines', width: 12 },
  ];
  dailySheet.getRow(1).font = { bold: true };
  data.daily.forEach((d) => dailySheet.addRow(d));

  const reminders = wb.addWorksheet('Сроки');
  reminders.columns = [
    { header: 'Тип', key: 'type', width: 20 },
    { header: 'Водитель', key: 'driver_name', width: 24 },
    { header: 'Срок', key: 'due_date', width: 14 },
    { header: 'Статус', key: 'status', width: 14 },
    { header: 'Заметка', key: 'note', width: 30 },
  ];
  reminders.getRow(1).font = { bold: true };
  data.reminders.forEach((r) =>
    reminders.addRow({ type: r.type, driver_name: r.driver_name || '—', due_date: r.due_date, status: STATUS_LABEL[r.status] || r.status, note: r.note || '' })
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ovi-report-${data.from || 'all'}_${data.to || 'now'}.xlsx"`,
    },
  });
}
