'use client';

import { useMemo, useState } from 'react';
import type { Driver, ShiftInfo } from '@/lib/types';
import { CARS } from '@/lib/checklist-data';
import { cashDiscrepancy, fmtKzt } from '@/lib/shared-calc';

type Props = {
  drivers: Driver[];
  info: ShiftInfo;
  onChange: (patch: Partial<ShiftInfo>) => void;
};

export default function ShiftInfoPanel({ drivers, info, onChange }: Props) {
  const [open, setOpen] = useState(true);
  const [carToAdd, setCarToAdd] = useState(CARS[0]);

  const discrepancy = useMemo(
    () => cashDiscrepancy(Number(info.cashStart) || 0, Number(info.cashEnd) || 0, Number(info.cashExpenses) || 0),
    [info.cashStart, info.cashEnd, info.cashExpenses]
  );
  const discColor = discrepancy === 0 ? 'text-emerald-400' : discrepancy < 0 ? 'text-red-400' : 'text-amber-400';

  function addCar() {
    if (!carToAdd || info.cars.includes(carToAdd)) return;
    onChange({ cars: [...info.cars, carToAdd] });
  }
  function removeCar(car: string) {
    const odo = { ...info.odo };
    delete odo[car];
    onChange({ cars: info.cars.filter((c) => c !== car), odo });
  }
  function setOdo(car: string, field: 'start' | 'end', val: string) {
    onChange({ odo: { ...info.odo, [car]: { ...info.odo[car], [field]: val } } });
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-neutral-100">Данные смены</span>
        <span className="text-neutral-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-3 border-t border-neutral-800 p-4 sm:grid-cols-2">
          <Field label="Водитель на смене">
            <select
              value={info.driverId}
              onChange={(e) => {
                const d = drivers.find((x) => x.id === e.target.value);
                onChange({ driverId: e.target.value, driverName: d?.name || '' });
              }}
              className="input"
            >
              <option value="">— выбрать —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Дата смены">
            <input type="date" value={info.date} onChange={(e) => onChange({ date: e.target.value })} className="input" />
          </Field>
          <Field label="Время начала">
            <input type="time" value={info.timeStart} onChange={(e) => onChange({ timeStart: e.target.value })} className="input" />
          </Field>
          <Field label="Время завершения">
            <input type="time" value={info.timeEnd} onChange={(e) => onChange({ timeEnd: e.target.value })} className="input" />
          </Field>
          <Field label="Место начала">
            <input value={info.placeStart} onChange={(e) => onChange({ placeStart: e.target.value })} className="input" />
          </Field>
          <Field label="Место завершения">
            <input value={info.placeEnd} onChange={(e) => onChange({ placeEnd: e.target.value })} className="input" />
          </Field>

          <div className="sm:col-span-2">
            <label className="label">Автомобиль(и)</label>
            <div className="flex gap-2">
              <select value={carToAdd} onChange={(e) => setCarToAdd(e.target.value)} className="input flex-1">
                {CARS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={addCar} className="btn-gold px-4">+</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {info.cars.map((c) => (
                <span key={c} className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-200">
                  {c}
                  <button onClick={() => removeCar(c)} className="text-neutral-500 hover:text-red-400">✕</button>
                </span>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 sm:grid-cols-4">
            <Field label="Касса начало"><input type="number" value={info.cashStart} onChange={(e) => onChange({ cashStart: e.target.value })} className="input" /></Field>
            <Field label="Касса конец"><input type="number" value={info.cashEnd} onChange={(e) => onChange({ cashEnd: e.target.value })} className="input" /></Field>
            <Field label="Расходы"><input type="number" value={info.cashExpenses} onChange={(e) => onChange({ cashExpenses: e.target.value })} className="input" /></Field>
            <Field label="Штрафы"><input type="number" value={info.cashFines} onChange={(e) => onChange({ cashFines: e.target.value })} className="input" /></Field>
            <div className="col-span-2 sm:col-span-4 text-sm">
              Расхождение кассы: <span className={`font-semibold ${discColor}`}>{fmtKzt(discrepancy)}</span>
            </div>
          </div>

          {info.cars.length > 0 && (
            <div className="sm:col-span-2 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(info.cars.length, 2)}, minmax(0,1fr))` }}>
              {info.cars.map((c) => (
                <div key={c} className="rounded-lg border border-neutral-800 p-3">
                  <p className="mb-2 text-xs text-neutral-400">{c} — пробег</p>
                  <div className="flex gap-2">
                    <input placeholder="Одометр начало" type="number" value={info.odo[c]?.start || ''} onChange={(e) => setOdo(c, 'start', e.target.value)} className="input" />
                    <input placeholder="Одометр конец" type="number" value={info.odo[c]?.end || ''} onChange={(e) => setOdo(c, 'end', e.target.value)} className="input" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
