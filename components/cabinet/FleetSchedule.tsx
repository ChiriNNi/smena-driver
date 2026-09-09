'use client';

import { useMemo, useState } from 'react';
import { carLabel, driverName, formatDate, todayISO } from '@/lib/labels';
import type { Assignment } from '@/lib/model';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, IconButton, Pill, SectionHeader, SelectField, Sheet } from './ui';

// График смен: кто на какой машине и когда работает. Сгруппирован по датам —
// так администратор видит день целиком и замечает пересечения.

export default function FleetSchedule() {
  const { assignments, drivers, cars, addAssignment, removeAssignment } = useStore();
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Assignment | null>(null);
  const activeDrivers = drivers.filter((d) => d.role === 'driver' && d.active);
  const [form, setForm] = useState({
    date: todayISO(),
    driverId: activeDrivers[0]?.id ?? '',
    carId: cars[0]?.id ?? '',
    timeStart: '08:00',
    timeEnd: '20:00',
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    [...assignments]
      .sort((a, b) => (a.date === b.date ? a.timeStart.localeCompare(b.timeStart) : a.date < b.date ? -1 : 1))
      .forEach((a) => map.set(a.date, [...(map.get(a.date) ?? []), a]));
    return [...map.entries()];
  }, [assignments]);

  /** Одно авто на одну дату у двух водителей — вероятная ошибка планирования. */
  function carConflict(a: Assignment): boolean {
    return assignments.some((x) => x.id !== a.id && x.date === a.date && x.carId === a.carId);
  }

  function save() {
    if (!form.driverId || !form.carId || !form.date) return;
    void addAssignment({ ...form });
    setAdding(false);
  }

  return (
    <>
      <SectionHeader
        title={`График · ${assignments.length}`}
        action={
          <button onClick={() => setAdding(true)} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Назначить
          </button>
        }
      />

      {grouped.length === 0 ? (
        <EmptyState icon="calendar" title="График пуст" hint="Назначьте водителя на авто и дату — он увидит смену в своём кабинете." />
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map(([date, items]) => (
            <div key={date} className="p-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Icon name="calendar" size={15} className="text-[#8fc640]" />
                <p className="text-sm font-bold">{formatDate(date)}</p>
                <span className="ml-auto text-xs text-[#9a9d96]">{items.length} смен.</span>
              </div>
              <div className="flex flex-col">
                {items.map((a) => (
                  <div key={a.id} className="p-card-line flex items-center gap-3 py-2 last:border-none">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{driverName(drivers, a.driverId)}</p>
                        {carConflict(a) && <Pill tone="bad">авто занято</Pill>}
                      </div>
                      <p className="truncate text-xs text-[#9a9d96]">
                        {a.timeStart}–{a.timeEnd} · {carLabel(cars, a.carId)}
                      </p>
                    </div>
                    <IconButton icon="trash" label="Снять с графика" tone="danger" onClick={() => setConfirmDelete(a)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <Sheet
          icon="calendar"
          title="Назначить смену"
          subtitle="Водитель, авто, дата и время"
          onClose={() => setAdding(false)}
          footer={
            <>
              <button onClick={() => setAdding(false)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={save} disabled={!form.driverId || !form.carId} className="p-btn p-btn-primary flex-1 py-3 text-xs">
                Назначить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="p-eyebrow mb-1.5 block">Дата</label>
              <input type="date" className="p-input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <SelectField label="Водитель" value={form.driverId} onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}>
              {activeDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.lastName} {d.firstName}
                </option>
              ))}
            </SelectField>
            <SelectField label="Автомобиль" value={form.carId} onChange={(e) => setForm((f) => ({ ...f, carId: e.target.value }))}>
              {cars
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.model} — {c.plate}
                  </option>
                ))}
            </SelectField>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="p-eyebrow mb-1.5 block">Начало</label>
                <input type="time" className="p-input" value={form.timeStart} onChange={(e) => setForm((f) => ({ ...f, timeStart: e.target.value }))} />
              </div>
              <div>
                <label className="p-eyebrow mb-1.5 block">Завершение</label>
                <input type="time" className="p-input" value={form.timeEnd} onChange={(e) => setForm((f) => ({ ...f, timeEnd: e.target.value }))} />
              </div>
            </div>
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Снять с графика?"
          message={`${driverName(drivers, confirmDelete.driverId)} на ${formatDate(confirmDelete.date)} будет снят с назначения.`}
          confirmLabel="Снять"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeAssignment(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}
