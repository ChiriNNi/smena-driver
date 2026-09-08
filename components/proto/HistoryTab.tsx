'use client';

import { useMemo, useState } from 'react';
import { carLabel, formatDate, money, type ProtoDriver, type ProtoShift } from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import ShiftReportModal from './ShiftReportModal';
import { EmptyState, Pill, SectionHeader, StatTile } from './ui';

// История смен водителя: только его собственные смены, отчёт открывается по клику.

export default function HistoryTab({ driver }: { driver: ProtoDriver }) {
  const { shifts, cars } = useStore();
  const [selected, setSelected] = useState<ProtoShift | null>(null);

  const own = useMemo(
    () => shifts.filter((s) => s.driverId === driver.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [shifts, driver.id]
  );

  const totals = useMemo(
    () => ({
      count: own.length,
      mileage: own.reduce((s, x) => s + Math.max(0, x.odoEnd - x.odoStart), 0),
    }),
    [own]
  );

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {own.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="clipboard" value={totals.count} label="Смен всего" />
          <StatTile icon="car" value={totals.mileage.toLocaleString('ru-RU')} label="Пробег, км" />
        </div>
      )}

      <SectionHeader title="История смен" />

      {own.length === 0 ? (
        <EmptyState icon="clock" title="Смен пока нет" hint="Завершите первую смену — она появится здесь вместе с отчётом." />
      ) : (
        own.map((s, i) => {
          const pct = s.total === 0 ? 0 : Math.round((s.done / s.total) * 100);
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="p-card p-fade-up p-4 text-left transition active:scale-[0.99]"
              style={{ animationDelay: `${Math.min(i, 6) * 0.05}s` }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">{formatDate(s.date)}</span>
                <span className="text-xs text-[#9a9d96]">
                  {s.timeStart}–{s.timeEnd}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-[#5c6066]">{carLabel(cars, s.carId)}</p>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7e9e2]">
                  <div
                    className={'h-full rounded-full ' + (pct === 100 ? 'bg-[#8fc640]' : 'bg-[#b5811c]')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums text-[#1a1d1e]">
                  {s.done}/{s.total}
                </span>
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
        })
      )}

      {selected && <ShiftReportModal shift={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
