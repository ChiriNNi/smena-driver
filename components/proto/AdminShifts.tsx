'use client';

import { useMemo, useState } from 'react';
import {
  carLabel,
  downloadFile,
  driverName,
  formatDate,
  money,
  shiftsToCsv,
  todayISO,
  type ProtoShift,
} from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import ShiftReportModal from './ShiftReportModal';
import { EmptyState, Pill, SectionHeader, SelectField, StatTile } from './ui';

// Смены всех водителей: сводка за период, фильтры, экспорт и отчёт по клику.

export default function AdminShifts() {
  const { shifts, drivers, cars } = useStore();
  const [driverId, setDriverId] = useState('all');
  const [carId, setCarId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openShift, setOpenShift] = useState<ProtoShift | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return shifts
      .filter((s) => (driverId === 'all' ? true : s.driverId === driverId))
      .filter((s) => (carId === 'all' ? true : s.carId === carId))
      .filter((s) => (from ? s.date >= from : true))
      .filter((s) => (to ? s.date <= to : true))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [shifts, driverId, carId, from, to]);

  const totals = useMemo(
    () => ({
      count: filtered.length,
      mileage: filtered.reduce((s, x) => s + Math.max(0, x.odoEnd - x.odoStart), 0),
      expenses: filtered.reduce((s, x) => s + x.cashExpenses, 0),
      fines: filtered.reduce((s, x) => s + x.cashFines, 0),
      remarks: filtered.reduce((s, x) => s + x.remarks.length, 0),
      incomplete: filtered.filter((x) => x.done < x.total).length,
    }),
    [filtered]
  );

  const filtersActive = driverId !== 'all' || carId !== 'all' || !!from || !!to;

  function resetFilters() {
    setDriverId('all');
    setCarId('all');
    setFrom('');
    setTo('');
  }

  function exportCsv() {
    downloadFile(`smena-shifts-${todayISO()}.csv`, shiftsToCsv(filtered, drivers, cars));
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="clipboard" value={totals.count} label="Смен за период" />
        <StatTile icon="car" value={totals.mileage.toLocaleString('ru-RU')} label="Пробег, км" />
        <StatTile icon="wallet" value={totals.expenses.toLocaleString('ru-RU')} label="Расходы, ₸" />
        <StatTile
          icon="warning"
          value={totals.fines.toLocaleString('ru-RU')}
          label="Штрафы, ₸"
          tone={totals.fines > 0 ? 'bad' : undefined}
        />
      </div>

      {(totals.remarks > 0 || totals.incomplete > 0) && (
        <div className="flex flex-wrap gap-2">
          {totals.remarks > 0 && <Pill tone="warn">Замечаний: {totals.remarks}</Pill>}
          {totals.incomplete > 0 && <Pill tone="bad">Чек-лист не закрыт: {totals.incomplete}</Pill>}
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
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="p-btn p-btn-dark flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs"
        >
          <Icon name="download" size={14} />
          Экспорт CSV
        </button>
      </div>

      {filtersOpen && (
        <div className="p-card p-fade-up flex flex-col gap-3 p-4">
          <SelectField label="Водитель" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="all">Все водители</option>
            {drivers
              .filter((d) => d.role === 'driver')
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.lastName} {d.firstName}
                </option>
              ))}
          </SelectField>
          <SelectField label="Автомобиль" value={carId} onChange={(e) => setCarId(e.target.value)}>
            <option value="all">Все авто</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.model} — {c.plate}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="p-eyebrow mb-1.5 block">Период с</label>
              <input type="date" className="p-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="p-eyebrow mb-1.5 block">по</label>
              <input type="date" className="p-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {filtersActive && (
            <button onClick={resetFilters} className="p-btn p-btn-outline py-2.5 text-xs">
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      <SectionHeader title={`Смены · ${filtered.length}`} />

      {filtered.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="Смен не найдено"
          hint={filtersActive ? 'Попробуйте изменить фильтры или сбросить их.' : 'Как только водители начнут закрывать смены, они появятся здесь.'}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s, i) => {
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
                    <p className="text-sm font-bold">{driverName(drivers, s.driverId)}</p>
                    <p className="truncate text-xs text-[#5c6066]">{carLabel(cars, s.carId)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold">{formatDate(s.date)}</p>
                    <p className="text-xs text-[#9a9d96]">{s.timeStart}–{s.timeEnd}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7e9e2]">
                    <div
                      className={'h-full rounded-full ' + (pct === 100 ? 'bg-[#8fc640]' : 'bg-[#b5811c]')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{s.done}/{s.total}</span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Pill tone="good">Итог {money(s.cashEnd)}</Pill>
                  {s.cashFines > 0 && <Pill tone="bad">Штраф {money(s.cashFines)}</Pill>}
                  {s.remarks.length > 0 && <Pill tone="warn">Замечаний {s.remarks.length}</Pill>}
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#9a9d96]">
                    Отчёт <Icon name="arrow-right" size={13} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openShift && <ShiftReportModal shift={openShift} onClose={() => setOpenShift(null)} />}
    </div>
  );
}
