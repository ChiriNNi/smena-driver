'use client';

import { useMemo, useState } from 'react';
import { km, money, uid, type ProtoCar } from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, Field, IconButton, Pill, SectionHeader, Sheet } from './ui';

// Автомобили парка: пробег и расходы считаются из смен и расходов, поэтому
// удалять авто, по которому уже есть смены, нельзя — только деактивировать.

export default function FleetCars() {
  const { cars, shifts, expenses, drivers, addCar, updateCar, removeCar } = useStore();
  const [editing, setEditing] = useState<ProtoCar | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProtoCar | null>(null);
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');

  const stats = useMemo(() => {
    const map: Record<string, { mileage: number; expenses: number; shifts: number; drivers: number }> = {};
    cars.forEach((c) => {
      const carShifts = shifts.filter((s) => s.carId === c.id);
      map[c.id] = {
        mileage: carShifts.reduce((sum, s) => sum + Math.max(0, s.odoEnd - s.odoStart), 0),
        expenses: expenses.filter((e) => e.carId === c.id).reduce((sum, e) => sum + e.amount, 0),
        shifts: carShifts.length,
        drivers: drivers.filter((d) => d.carId === c.id).length,
      };
    });
    return map;
  }, [cars, shifts, expenses, drivers]);

  function openNew() {
    setModel('');
    setPlate('');
    setEditing('new');
  }

  function openEdit(car: ProtoCar) {
    setModel(car.model);
    setPlate(car.plate);
    setEditing(car);
  }

  function save() {
    if (!model.trim() || !plate.trim()) return;
    if (editing === 'new') {
      addCar({ id: uid('c'), model: model.trim(), plate: plate.trim().toUpperCase(), active: true });
    } else if (editing) {
      updateCar(editing.id, { model: model.trim(), plate: plate.trim().toUpperCase() });
    }
    setEditing(null);
  }

  function tryDelete(car: ProtoCar) {
    if (stats[car.id]?.shifts > 0) return; // защита: по авто есть смены
    setConfirmDelete(car);
  }

  return (
    <>
      <SectionHeader
        title={`Автомобили · ${cars.length}`}
        action={
          <button onClick={openNew} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Добавить
          </button>
        }
      />

      {cars.length === 0 ? (
        <EmptyState icon="car" title="Автопарк пуст" hint="Добавьте первый автомобиль — он появится в списке при начале смены у водителя." />
      ) : (
        <div className="flex flex-col gap-2">
          {cars.map((car) => {
            const st = stats[car.id];
            const locked = st?.shifts > 0;
            return (
              <div key={car.id} className="p-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{car.model}</p>
                    <p className="text-xs font-semibold tabular-nums text-[#5c6066]">{car.plate}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {car.active ? <Pill tone="good">в работе</Pill> : <Pill>не активен</Pill>}
                    <IconButton icon="pencil" label="Изменить" onClick={() => openEdit(car)} />
                    <IconButton
                      icon="power"
                      label={car.active ? 'Деактивировать' : 'Вернуть в работу'}
                      onClick={() => updateCar(car.id, { active: !car.active })}
                    />
                    <IconButton icon="trash" label="Удалить" tone="danger" disabled={locked} onClick={() => tryDelete(car)} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#e7e9e2] pt-3">
                  <div>
                    <p className="text-sm font-bold tabular-nums">{st?.shifts ?? 0}</p>
                    <p className="p-eyebrow mt-0.5">Смен</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">{km(st?.mileage ?? 0)}</p>
                    <p className="p-eyebrow mt-0.5">Пробег</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">{money(st?.expenses ?? 0)}</p>
                    <p className="p-eyebrow mt-0.5">Расходы</p>
                  </div>
                </div>

                {locked && (
                  <p className="mt-2 text-[11px] leading-relaxed text-[#9a9d96]">
                    По авто есть закрытые смены — удалить нельзя, чтобы не сломать историю. Используйте деактивацию.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Sheet
          icon="car"
          title={editing === 'new' ? 'Новый автомобиль' : 'Изменить автомобиль'}
          subtitle={editing === 'new' ? 'Появится в списке у водителей' : `${editing.model} — ${editing.plate}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button
                onClick={save}
                disabled={!model.trim() || !plate.trim()}
                className="p-btn p-btn-primary flex-1 py-3 text-xs"
              >
                Сохранить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label="Модель" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Mercedes-Benz W223" />
            <Field
              label="Госномер"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="001ICG01"
              hint="Так авто будет подписано в чек-листах и отчётах."
            />
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить автомобиль?"
          message={`${confirmDelete.model} — ${confirmDelete.plate} исчезнет из списка. Действие необратимо.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeCar(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}
