import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ok, uuid, withAdmin } from '@/lib/api-helpers';
import { formatDateRu, shiftsCount } from '@/lib/report-text';
import type { ShiftRow } from '@/lib/model';

export const dynamic = 'force-dynamic';

// Выгрузка истории смен: CSV для быстрой проверки и XLSX для отчётности.
// Фильтры те же, что в админке, — выгружается ровно то, что видно на экране.
//
// В книге три листа, потому что в одну таблицу это не складывается:
//   «Смены»     — строка на смену, с итогами за период;
//   «Касса»     — журнал по каждой смене столбиком, как его ведут на бумаге:
//                 начало, приход, расход, остаток;
//   «Замечания» — строка на каждое замечание, а не всё скопом в одной ячейке.
//
// Даты и суммы уходят числами с форматом, а не текстом: иначе в Excel по ним
// нельзя ни отсортировать, ни посчитать сумму — а именно это с выгрузкой и
// делают.

const MONEY_FMT = '#,##0" ₸"';
const KM_FMT = '#,##0';
const DATE_FMT = 'dd.mm.yyyy';

/**
 * Колонка листа «Смены»: подпись, значение, формат и участие в итогах.
 * Раньше номера денежных, километровых и суммируемых колонок лежали тремя
 * отдельными массивами — добавление колонки сдвигало формат у соседних.
 */
type Column = {
  title: string;
  value: (r: Row) => string | number;
  fmt?: string;
  sum?: boolean;
};

type Row = ShiftRow & { remarks: string | null; remark_count: number };

const mileage = (r: Row) => Math.max(0, Number(r.odo_end) - Number(r.odo_start));

/**
 * Дата как полночь UTC: exceljs считает серийный номер прямо из времени в
 * миллисекундах, поэтому местная полночь в отрицательном часовом поясе даёт
 * в файле предыдущий день.
 */
function toDateValue(iso: string): Date | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function editedMark(r: Row): string {
  if (!r.edited_at) return '';
  const when = String(r.edited_at).slice(0, 10);
  return r.edited_by_label ? `${formatDateRu(when)}, ${r.edited_by_label}` : formatDateRu(when);
}

const COLUMNS: Column[] = [
  { title: 'Дата', value: (r) => formatDateRu(r.date_iso) },
  { title: 'Водитель', value: (r) => r.driver_label },
  { title: 'Авто', value: (r) => r.car_label },
  { title: 'Начало', value: (r) => r.time_start },
  { title: 'Завершение', value: (r) => r.time_end },
  { title: 'Место начала', value: (r) => r.place_start },
  { title: 'Место завершения', value: (r) => r.place_end },
  { title: 'Выполнено', value: (r) => r.checklist_done, sum: true },
  { title: 'Пунктов всего', value: (r) => r.checklist_total, sum: true },
  { title: 'Одометр начало', value: (r) => Number(r.odo_start), fmt: KM_FMT },
  { title: 'Одометр конец', value: (r) => Number(r.odo_end), fmt: KM_FMT },
  { title: 'Пробег, км', value: mileage, fmt: KM_FMT, sum: true },
  { title: 'Касса начало', value: (r) => Number(r.cash_start), fmt: MONEY_FMT },
  { title: 'Приход', value: (r) => Number(r.cash_income), fmt: MONEY_FMT, sum: true },
  { title: 'От кого приход', value: (r) => r.cash_income_note ?? '' },
  { title: 'Расход', value: (r) => Number(r.cash_expenses), fmt: MONEY_FMT, sum: true },
  { title: 'На что расход', value: (r) => r.cash_expenses_note ?? '' },
  { title: 'Штрафы', value: (r) => Number(r.cash_fines), fmt: MONEY_FMT, sum: true },
  { title: 'Остаток', value: (r) => Number(r.cash_end), fmt: MONEY_FMT },
  { title: 'Замечаний', value: (r) => Number(r.remark_count) || 0, sum: true },
  { title: 'Исправлено', value: editedMark },
];

const TITLES = COLUMNS.map((c) => c.title);

/** Значения строки. В книге дата уходит настоящей датой, в CSV — текстом. */
function toCells(r: Row, dateAsText: boolean): (string | number | Date)[] {
  const cells = COLUMNS.map((c) => c.value(r));
  return dateAsText ? cells : [toDateValue(r.date_iso), ...cells.slice(1)];
}

/** CSV с BOM и точкой с запятой — иначе Excel на Windows ломает кириллицу. */
function buildCsv(rows: Row[]): string {
  // В CSV колонок на одну больше: замечания одной строкой — в книге под них
  // отдельный лист, а в плоской таблице деть их некуда.
  const header = [...TITLES, 'Замечания'];
  const body = rows.map((r) => [...toCells(r, true), r.remarks ?? '']);
  const lines = [header, ...body].map((row) =>
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
  wb.created = new Date();

  buildShiftsSheet(wb.addWorksheet('Смены'), rows);
  buildCashSheet(wb.addWorksheet('Касса'), rows);
  buildRemarksSheet(wb.addWorksheet('Замечания'), rows);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

type Sheet = import('exceljs').Worksheet;

function buildShiftsSheet(ws: Sheet, rows: Row[]): void {
  ws.addRow([...TITLES]);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  // Заголовок остаётся на месте при прокрутке, а фильтр позволяет отобрать
  // водителя или машину прямо в файле.
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  // Строки собираются один раз: по ним же считаются итоги и ширина колонок.
  const cells = rows.map((r) => toCells(r, false));
  cells.forEach((row) => ws.addRow(row));

  // Итоги за период — то, ради чего выгрузку обычно и открывают.
  if (cells.length > 0) {
    const totals: (string | number)[] = COLUMNS.map((c, i) =>
      c.sum ? cells.reduce((sum, row) => sum + (Number(row[i]) || 0), 0) : ''
    );
    totals[0] = `Итого: ${shiftsCount(cells.length)}`;
    const row = ws.addRow(totals);
    row.font = { bold: true };
    row.border = { top: { style: 'thin' } };
  }

  ws.getColumn(1).numFmt = DATE_FMT;
  COLUMNS.forEach((c, i) => {
    if (c.fmt) ws.getColumn(i + 1).numFmt = c.fmt;
    // Ширина по самому длинному значению, но в разумных пределах: узкие
    // колонки обрезают суммы, широкие не дают увидеть строку целиком.
    const widest = cells.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), c.title.length);
    ws.getColumn(i + 1).width = Math.min(Math.max(widest + 2, 11), 34);
  });
}

/**
 * Журнал кассы: на каждую смену столбик, как в бумажной тетради. Именно в
 * таком виде отчёт и сводят вручную, поэтому пересчитывать ничего не нужно —
 * итоги уже посчитаны, а остаток каждой смены равен началу следующей.
 */
function buildCashSheet(ws: Sheet, rows: Row[]): void {
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 40;
  ws.getColumn(4).numFmt = MONEY_FMT;

  const title = ws.addRow(['Дата', 'Водитель', 'Строка', 'Сумма', 'Комментарий']);
  title.font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // По возрастанию даты: журнал читается сверху вниз, и переход остатка в
  // начало следующей смены виден сразу.
  const ordered = [...rows].reverse();

  for (const r of ordered) {
    const income = Number(r.cash_income);
    const start = Number(r.cash_start);
    const expenses = Number(r.cash_expenses);
    const fines = Number(r.cash_fines);

    const lines: [string, number, string][] = [
      ['Начало смены', start, ''],
      ['Приход', income, r.cash_income_note ?? ''],
      ['Итого доход', start + income, ''],
      ['Расход', expenses, r.cash_expenses_note ?? ''],
      ['Штрафы', fines, ''],
      ['Итого расход', expenses + fines, ''],
      ['Остаток на конец', Number(r.cash_end), ''],
    ];

    lines.forEach(([label, amount, note], i) => {
      const row = ws.addRow([
        i === 0 ? toDateValue(r.date_iso) : '',
        i === 0 ? r.driver_label : '',
        label,
        amount,
        note,
      ]);
      row.getCell(1).numFmt = DATE_FMT;
      if (label.startsWith('Итого') || label.startsWith('Остаток')) row.font = { bold: true };
      if (label === 'Остаток на конец') row.getCell(4).border = { top: { style: 'thin' } };
    });

    ws.addRow([]);
  }

  if (ordered.length > 0) {
    const sum = (pick: (r: Row) => number) => ordered.reduce((acc, r) => acc + pick(r), 0);
    const total = ws.addRow([
      '',
      `Итого за период · ${shiftsCount(ordered.length)}`,
      'Приход',
      sum((r) => Number(r.cash_income)),
      '',
    ]);
    total.font = { bold: true };
    ws.addRow(['', '', 'Расход и штрафы', sum((r) => Number(r.cash_expenses) + Number(r.cash_fines)), '']).font = {
      bold: true,
    };
  }
}

function buildRemarksSheet(ws: Sheet, rows: Row[]): void {
  const header = ['Дата', 'Водитель', 'Авто', 'Пункт чек-листа', 'Замечание', 'Фото'];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Замечания в отдельные строки разворачиваются здесь же в SQL (см. запрос):
  // в поле remarks они склеены разделителем, а в отчёте нужна строка на каждое.
  let count = 0;
  for (const r of [...rows].reverse()) {
    for (const entry of splitRemarks(r.remarks)) {
      ws.addRow([toDateValue(r.date_iso), r.driver_label, r.car_label, entry.text, entry.comment, entry.photos]);
      ws.getRow(ws.rowCount).getCell(1).numFmt = DATE_FMT;
      count += 1;
    }
  }

  if (count === 0) ws.addRow(['', '', '', 'Замечаний за период нет', '', '']);

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 30;
  ws.getColumn(4).width = 42;
  ws.getColumn(5).width = 60;
  ws.getColumn(6).width = 7;
  ws.getColumn(5).alignment = { wrapText: true, vertical: 'top' };
}

/** Разбор склеенного поля замечаний: «пункт: комментарий [фото N]». */
function splitRemarks(raw: string | null): { text: string; comment: string; photos: number }[] {
  if (!raw) return [];
  return raw.split(REMARK_SEPARATOR).map((chunk) => {
    const photos = /\[фото (\d+)\]$/.exec(chunk);
    const body = photos ? chunk.slice(0, photos.index).trim() : chunk.trim();
    const split = body.indexOf(': ');
    return {
      text: split === -1 ? body : body.slice(0, split),
      comment: split === -1 ? '' : body.slice(split + 2),
      photos: photos ? Number(photos[1]) : 0,
    };
  });
}

const REMARK_SEPARATOR = ' | ';

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

    // Замечания собираются в одну строку прямо в запросе, с числом фото у
    // каждого: на листе «Замечания» строка разбирается обратно по пунктам.
    const rows = await query<Row>(
      `SELECT s.id, s.driver_id, s.car_id, s.driver_label, s.car_label, s.date_iso::text AS date_iso,
              s.time_start, s.time_end, s.place_start, s.place_end,
              s.cash_start, s.cash_end, s.cash_income, s.cash_income_note,
              s.cash_expenses, s.cash_expenses_note, s.cash_fines, s.odo_start, s.odo_end,
              s.checklist_done, s.checklist_total,
              s.edited_at::text AS edited_at, s.edited_by_label,
              r.remarks, coalesce(r.remark_count, 0) AS remark_count
       FROM shifts s
       LEFT JOIN LATERAL (
         SELECT string_agg(
                  i.item_text || coalesce(': ' || nullif(i.comment, ''), '')
                    || CASE WHEN coalesce(array_length(i.photo_paths, 1), 0) > 0
                            THEN ' [фото ' || array_length(i.photo_paths, 1) || ']' ELSE '' END,
                  '${REMARK_SEPARATOR}' ORDER BY i.position) AS remarks,
                count(*) AS remark_count
         FROM shift_items i
         WHERE i.shift_id = s.id
           AND (coalesce(i.comment, '') <> '' OR coalesce(array_length(i.photo_paths, 1), 0) > 0)
       ) r ON true
       ${where}
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
