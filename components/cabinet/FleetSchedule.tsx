'use client';

import { useMemo, useState } from 'react';
import { formatDate, km, money, shiftsCount } from '@/lib/labels';
import type { Shift } from '@/lib/model';
import { useStore } from './store';
import { Icon } from './icons';
import ShiftReportModal from './ShiftReportModal';
import { EmptyState, Pill, SectionHeader, StatTile } from './ui';

// График смен — по факту, а не по плану.
//
// Раньше здесь заполнялось отдельное «назначение»: водитель, авто, дата, время.
// На практике график и есть то, как смены закрыли: водитель фиксирует начало и
// завершение сам, и второй, заранее заполняемый список ту же информацию только
// дублировал — и расходился с ней, как только смена шла не по плану.
//
// Поэтому экран собирается из закрытых смен: день целиком, кто на какой машине
// работал, сколько наездил и с каким остатком кассы сдал. Пересечения по
// машине видны сразу — это тот же признак, что и раньше, только по факту.

/** Смены одного дня. */
type Day = { date: string; shifts: Shift[] };

export default function FleetSchedule() {
  const { shifts, cars } = useStore();
  const [openShift, setOpenShift] = useState<Shift | null>(null);

  const days = useMemo<Day[]>(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, list]) => ({
        date,
        shifts: [...list].sort((a, b) => a.timeStart.localeCompare(b.timeStart)),
      }));
  }, [shifts]);

  const totals = useMemo(
    () => ({
      days: days.length,
      // Сколько машин из парка вообще выходило на смену за загруженный период —
      // по этому числу видно простой: 2 из 5 значит три машины стояли.
      cars: new Set(shifts.map((s) => s.carId).filter(Boolean)).size,
    }),
    [days.length, shifts]
  );

  /** Одна машина у двух водителей в один день — стоит посмотреть, так ли задумано. */
  function sameCarTwice(day: Day, shift: Shift): boolean {
    return day.shifts.some((x) => x.id !== shift.id && x.carId === shift.carId && shift.carId !== '');
  }

  if (days.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Смен пока нет"
        hint="График собирается из закрытых смен: как только водитель сдаст первую, здесь появится день."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="calendar" value={totals.days} label="Дней со сменами" />
        <StatTile icon="car" value={`${totals.cars}/${cars.length}`} label="Машин выходило" />
      </div>

      <SectionHeader title="График по факту" hint="собран из закрытых смен" />

      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <div key={day.date} className="p-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Icon name="calendar" size={15} className="text-[#8fc640]" />
              <p className="text-sm font-bold">{formatDate(day.date)}</p>
              <span className="ml-auto text-xs text-[#9a9d96]">{shiftsCount(day.shifts.length)}</span>
            </div>

            <div className="flex flex-col">
              {day.shifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setOpenShift(s)}
                  className="p-card-line flex items-center gap-3 py-2.5 text-left last:border-none"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{s.driverLabel}</p>
                      {sameCarTwice(day, s) && <Pill tone="warn">авто в двух сменах</Pill>}
                      {s.done < s.total && <Pill tone="bad">чек-лист не закрыт</Pill>}
                    </div>
                    <p className="truncate text-xs text-[#9a9d96]">
                      {s.timeStart}–{s.timeEnd} · {s.carLabel}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#9a9d96]">
                      {km(Math.max(0, s.odoEnd - s.odoStart))} · остаток {money(s.cashEnd)}
                    </p>
                  </div>
                  <Icon name="arrow-right" size={15} className="shrink-0 text-[#9a9d96]" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {openShift && <ShiftReportModal shift={openShift} onClose={() => setOpenShift(null)} />}
    </>
  );
}
