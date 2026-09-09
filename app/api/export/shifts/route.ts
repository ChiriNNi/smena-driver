import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ok, uuid, withAdmin } from '@/lib/api-helpers';
import { formatDateRu } from '@/lib/report-text';
import type { ShiftRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

// Выгрузка истории смен: CSV для быстрой проверки и XLSX для отчётности.
// Фильтры те же, что в админке, — выгружается ровно то, что видно на экране.

const HEADER = [
  'Дата',
  'Водитель',
  'Авто',
  'Начало',
  'Завершение',
  'Место начала',
  'Место завершения',
  'Чек-лист выполнено',
  'Чек-лист всего',
  'Пробег, км',
  'Касса начало',
  'Расходы',
  'Штрафы',
  'Касса конец',
  'Замечания',
];

type Row = ShiftRow & { remarks: string | null };

function toCells(r: Row): (string | number)[] {
  return [
    formatDateRu(r.date_iso),
    r.driver_label,
    r.car_label,
    r.time_start,
    r.time_end,
    r.place_start,
    r.place_end,
    r.checklist_done,
    r.checklist_total,
    Math.max(0, Number(r.odo_end) - Number(r.odo_start)),
    Number(r.cash_start),
    Number(r.cash_expenses),
    Number(r.cash_fines),
    Number(r.cash_end),
    r.remarks ?? '',
  ];
}

/** CSV с BOM и точкой с запятой — иначе Excel на Windows ломает кириллицу. */
function buildCsv(rows: Row[]): string {
  const lines = [HEADER, ...rows.map(toCells)].map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
  );
  return '﻿' + lines.join('\r\n');
}

async function buildXlsx(rows: Row[]): Promise<Buffer> {
  // exceljs подгружается только когда действительно нужен файл Excel —
  // библиотека тяжёлая, а CSV запрашивают чаще.
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smena';
  const ws = wb.addWorksheet('Смены');

  ws.addRow(HEADER);
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(toCells(r)));
  ws.columns.forEach((col, i) => {
    col.width = i === HEADER.length - 1 ? 60 : Math.max(12, HEADER[i].length + 2);
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function GET(req: NextRequest) {
  return withAdmin(async () => {
    const q = req.nextUrl.searchParams;
    const conditions: string[] = [];
    const params: unknown[] = [];

    const driverId = uuid(q.get('driverId'), 'водитель');
    const carId = uuid(q.get('carId'), 'автомобиль');
    if (driverId) { params.push(driverId); conditions.push(`s.driver_id = $${params.length}`); }
    if (carId) { params.push(carId); conditions.push(`s.car_id = $${params.length}`); }
    const from = q.get('from');
    const to = q.get('to');
    if (from) { params.push(from); conditions.push(`s.date_iso >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`s.date_iso <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Замечания собираются в одну ячейку прямо в запросе — в таблице это одна
    // колонка, и отдельным обходом строк тут ничего не выигрывается.
    const rows = await query<Row>(
      `SELECT s.id, s.driver_id, s.car_id, s.driver_label, s.car_label, s.date_iso::text AS date_iso,
              s.time_start, s.time_end, s.place_start, s.place_end,
              s.cash_start, s.cash_end, s.cash_expenses, s.cash_fines, s.odo_start, s.odo_end,
              s.checklist_done, s.checklist_total,
              (SELECT string_agg(
                 i.item_text || coalesce(': ' || nullif(i.comment, ''), ''), ' | ' ORDER BY i.position)
               FROM shift_items i
               WHERE i.shift_id = s.id
                 AND (coalesce(i.comment, '') <> '' OR coalesce(array_length(i.photo_paths, 1), 0) > 0)
              ) AS remarks
       FROM shifts s ${where}
       ORDER BY s.date_iso DESC, s.created_at DESC
       LIMIT 5000`,
      params
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const format = q.get('format') === 'xlsx' ? 'xlsx' : q.get('format') === 'csv' ? 'csv' : '';

    if (format === 'xlsx') {
      const buffer = await buildXlsx(rows);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="smena-shifts-${stamp}.xlsx"`,
        },
      });
    }

    if (format === 'csv') {
      return new NextResponse(buildCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="smena-shifts-${stamp}.csv"`,
        },
      });
    }

    // Без параметра format отдаём количество строк: интерфейс может показать,
    // сколько смен попадёт в выгрузку, прежде чем скачивать файл.
    return ok({ count: rows.length });
  });
}
