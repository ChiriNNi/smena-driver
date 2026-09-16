'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';
import { formatDate, money } from '@/lib/labels';
import type { Shift } from '@/lib/model';
import { useStore } from './store';
import { Icon } from './icons';
import ShiftEditSheet from './ShiftEditSheet';
import ShiftReportModal from './ShiftReportModal';
import { EmptyState, Field, Pill, SectionHeader, SelectField, StatTile } from './ui';

// Смены всех водителей: сводка за период, фильтры, экспорт и отчёт по клику.
//
// Отбор идёт на сервере, а не по уже загруженному списку. Раньше экран
// фильтровал последние 200 смен, которые пришли при запуске: период «март»
// показывал пусто и «Смен за период: 0», хотя в базе смены были, — а кнопка
// «Excel» с тем же фильтром их выгружала. Экран и файл обязаны показывать одно
// и то же, поэтому фильтры уходят в тот же запрос, что и выгрузка.

/** Пауза перед запросом: администратор набирает даты, а не жмёт «применить». */
const FILTER_DELAY_MS = 400;

/** Сколько смен сервер отдаёт на один запрос — столько же попадёт и в файл. */
const PAGE_LIMIT = 1000;

type Filters = { driverId: string; carId: string; from: string; to: string };

const EMPTY: Filters = { driverId: 'all', carId: 'all', from: '', to: '' };

export default function AdminShifts() {
  const { shifts, drivers, cars, updateShift } = useStore();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Ответ сервера хранится вместе с запросом, которому он отвечает: пока
  // пришедшая выборка не совпадает с текущими фильтрами, она не показывается.
  // Так не нужно сбрасывать список при каждой смене фильтра — и не бывает
  // мгновения, когда на экране данные от прошлого отбора.
  const [fetched, setFetched] = useState<{ key: string; rows: Shift[] } | null>(null);
  const [error, setError] = useState('');

  const filtersActive = filters.driverId !== 'all' || filters.carId !== 'all' || !!filters.from || !!filters.to;

  const query = useMemo<api.ShiftFilters>(
    () => ({
      driverId: filters.driverId === 'all' ? undefined : filters.driverId,
      carId: filters.carId === 'all' ? undefined : filters.carId,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [filters]
  );
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!filtersActive) return;

    let alive = true;
    const timer = setTimeout(() => {
      api.shifts
        .list({ ...query, limit: PAGE_LIMIT })
        .then((rows) => {
          if (!alive) return;
          setFetched({ key: queryKey, rows });
          setError('');
        })
        .catch((err) => {
          if (alive) setError(err instanceof Error ? err.message : 'Не удалось загрузить смены.');
        });
    }, FILTER_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, queryKey, filtersActive]);

  // null — выборка по фильтрам ещё едет; пустой массив — смен действительно нет.
  const list = useMemo<Shift[] | null>(() => {
    const base = !filtersActive ? shifts : fetched?.key === queryKey ? fetched.rows : null;
    return base && [...base].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [fetched, queryKey, filtersActive, shifts]);

  const totals = useMemo(() => {
    const rows = list ?? [];
    return {
      count: rows.length,
      mileage: rows.reduce((s, x) => s + Math.max(0, x.odoEnd - x.odoStart), 0),
      income: rows.reduce((s, x) => s + x.cashIncome, 0),
      expenses: rows.reduce((s, x) => s + x.cashExpenses, 0),
      fines: rows.reduce((s, x) => s + x.cashFines, 0),
      remarks: rows.reduce((s, x) => s + x.remarks.length, 0),
      incomplete: rows.filter((x) => x.done < x.total).length,
      edited: rows.filter((x) => x.editedAt).length,
    };
  }, [list]);

  const set = useCallback((patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), []);

  /**
   * Файл собирает сервер: в него попадают те же фильтры, что на экране,
   * а выгрузка не ограничена уже загруженной страницей истории.
   */
  const exportUrl = (format: 'csv' | 'xlsx') => api.shifts.exportUrl(format, query);

  async function saveEdit(patch: api.ShiftPatch) {
    if (!editing) return;
    const next = await updateShift(editing.id, patch);
    if (!next) return;
    // Обновляем и отфильтрованный список, и открытый отчёт: исправленные
    // суммы должны быть видны сразу, без перезагрузки экрана.
    setFetched((prev) => prev && { ...prev, rows: prev.rows.map((s) => (s.id === next.id ? next : s)) });
    setOpenShift((prev) => (prev && prev.id === next.id ? next : prev));
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="clipboard" value={totals.count} label="Смен за период" />
        <StatTile icon="car" value={totals.mileage.toLocaleString('ru-RU')} label="Пробег, км" />
        <StatTile icon="wallet" value={totals.income.toLocaleString('ru-RU')} label="Приход, ₸" />
        <StatTile icon="wallet" value={totals.expenses.toLocaleString('ru-RU')} label="Расход, ₸" />
      </div>

      {(totals.fines > 0 || totals.remarks > 0 || totals.incomplete > 0 || totals.edited > 0) && (
        <div className="flex flex-wrap gap-2">
          {totals.fines > 0 && <Pill tone="bad">Штрафы {money(totals.fines)}</Pill>}
          {totals.remarks > 0 && <Pill tone="warn">Замечаний: {totals.remarks}</Pill>}
          {totals.incomplete > 0 && <Pill tone="bad">Чек-лист не закрыт: {totals.incomplete}</Pill>}
          {totals.edited > 0 && <Pill tone="warn">Исправлено: {totals.edited}</Pill>}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={
            'p-btn flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs ' +
            (filtersActive ? 'p-btn-primary' : 'p-btn-outline')
          }
        >
          <Icon name="settings" size={14} />
          {filtersActive ? 'Фильтры активны' : 'Фильтры'}
        </button>
        {/* Обычные ссылки, а не fetch: файл отдаёт сервер, и браузер сам
            запускает скачивание — так работает и на телефоне. */}
        <a
          href={exportUrl('csv')}
          className="p-btn p-btn-dark flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs"
        >
          <Icon name="download" size={14} />
          CSV
        </a>
        <a
          href={exportUrl('xlsx')}
          className="p-btn p-btn-outline flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs"
        >
          <Icon name="download" size={14} />
          Excel
        </a>
      </div>

      {filtersOpen && (
        <div className="p-card p-fade-up flex flex-col gap-3 p-4">
          <SelectField label="Водитель" value={filters.driverId} onChange={(e) => set({ driverId: e.target.value })}>
            <option value="all">Все водители</option>
            {drivers
              .filter((d) => d.role === 'driver')
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.lastName} {d.firstName}
                </option>
              ))}
          </SelectField>
          <SelectField label="Автомобиль" value={filters.carId} onChange={(e) => set({ carId: e.target.value })}>
            <option value="all">Все авто</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.model} — {c.plate}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Период с" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
            <Field label="по" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
          </div>
          {filtersActive && (
            <button onClick={() => setFilters(EMPTY)} className="p-btn p-btn-outline py-2.5 text-xs">
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      <SectionHeader
        title={list === null ? 'Смены' : `Смены · ${list.length}`}
        hint={
          list === null
            ? 'загружаем…'
            : filtersActive
              ? list.length >= PAGE_LIMIT
                ? `показаны первые ${PAGE_LIMIT} — сузьте период`
                : 'отобраны на сервере'
              : 'последние смены'
        }
      />

      {error && <p className="text-xs font-semibold text-[#c0564a]">{error}</p>}

      {list === null ? (
        <p className="px-1 py-6 text-center text-sm text-[#9a9d96]">Загружаем смены за период…</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="Смен не найдено"
          hint={
            filtersActive
              ? 'Попробуйте изменить фильтры или сбросить их.'
              : 'Как только водители начнут закрывать смены, они появятся здесь.'
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((s, i) => {
            const pct = s.total === 0 ? 0 : Math.round((s.done / s.total) * 100);
            return (
              <button
                key={s.id}
                onClick={() => setOpenShift(s)}
                className="p-card p-fade-up p-4 text-left transition active:scale-[0.99]"
                style={{ animationDelay: `${Math.min(i, 6) * 0.04}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{s.driverLabel}</p>
                    <p className="truncate text-xs text-[#5c6066]">{s.carLabel}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold">{formatDate(s.date)}</p>
                    <p className="text-xs text-[#9a9d96]">
                      {s.timeStart}–{s.timeEnd}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7e9e2]">
                    <div
                      className={'h-full rounded-full ' + (pct === 100 ? 'bg-[#8fc640]' : 'bg-[#b5811c]')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums">
                    {s.done}/{s.total}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Pill tone="good">Остаток {money(s.cashEnd)}</Pill>
                  {s.cashIncome > 0 && <Pill>Приход {money(s.cashIncome)}</Pill>}
                  {s.cashFines > 0 && <Pill tone="bad">Штраф {money(s.cashFines)}</Pill>}
                  {s.remarks.length > 0 && <Pill tone="warn">Замечаний {s.remarks.length}</Pill>}
                  {s.editedAt && <Pill tone="warn">исправлена</Pill>}
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#9a9d96]">
                    Отчёт <Icon name="arrow-right" size={13} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openShift && (
        <ShiftReportModal
          shift={openShift}
          onClose={() => setOpenShift(null)}
          onRequestEdit={() => setEditing(openShift)}
        />
      )}

      {editing && <ShiftEditSheet shift={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
    </div>
  );
}
