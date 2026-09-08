'use client';

import { useMemo, useState } from 'react';
import {
  carLabel,
  driverName,
  EXPENSE_CATEGORIES,
  formatDate,
  money,
  todayISO,
  uid,
  type ExpenseCategory,
  type ProtoExpense,
} from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, Field, IconButton, Pill, SectionHeader, SelectField, Sheet, StatTile } from './ui';

// Расходы по автопарку: топливо, мойка, ТО, штрафы. Заводит администратор,
// в проде часть будет прилетать автоматически из завершённых смен.

export default function FleetExpenses() {
  const { expenses, cars, drivers, addExpense, removeExpense } = useStore();
  const [carFilter, setCarFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProtoExpense | null>(null);

  const [form, setForm] = useState({
    carId: cars[0]?.id ?? '',
    driverId: drivers.find((d) => d.role === 'driver')?.id ?? '',
    date: todayISO(),
    category: EXPENSE_CATEGORIES[0] as ExpenseCategory,
    amount: '',
    comment: '',
  });

  const filtered = useMemo(
    () =>
      expenses
        .filter((e) => (carFilter === 'all' ? true : e.carId === carFilter))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [expenses, carFilter]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const fines = filtered.filter((e) => e.category === 'Штраф').reduce((s, e) => s + e.amount, 0);

  function save() {
    if (!form.carId || !form.amount) return;
    addExpense({
      id: uid('e'),
      carId: form.carId,
      driverId: form.driverId,
      date: form.date,
      category: form.category,
      amount: Number(form.amount),
      comment: form.comment.trim(),
    });
    setForm((f) => ({ ...f, amount: '', comment: '' }));
    setAdding(false);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="wallet" value={total.toLocaleString('ru-RU')} label="Всего, ₸" />
        <StatTile icon="warning" value={fines.toLocaleString('ru-RU')} label="Из них штрафы, ₸" tone={fines > 0 ? 'bad' : undefined} />
      </div>

      <SelectField label="Автомобиль" value={carFilter} onChange={(e) => setCarFilter(e.target.value)}>
        <option value="all">Все авто</option>
        {cars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.model} — {c.plate}
          </option>
        ))}
      </SelectField>

      {byCategory.length > 0 && (
        <div className="p-card p-4">
          <p className="p-eyebrow mb-2">По категориям</p>
          <div className="flex flex-col">
            {byCategory.map(([cat, sum]) => (
              <div key={cat} className="p-card-line flex items-center justify-between py-2 text-sm last:border-none">
                <span className="text-[#5c6066]">{cat}</span>
                <span className="font-semibold tabular-nums">{money(sum)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionHeader
        title={`Операции · ${filtered.length}`}
        action={
          <button onClick={() => setAdding(true)} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Добавить
          </button>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState icon="fuel" title="Расходов нет" hint="Добавьте заправку, мойку или ТО — они попадут в сводку по автомобилю." />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((e) => (
            <div key={e.id} className="p-card flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold tabular-nums">{money(e.amount)}</p>
                  {e.category === 'Штраф' ? <Pill tone="bad">{e.category}</Pill> : <Pill>{e.category}</Pill>}
                </div>
                <p className="mt-0.5 truncate text-xs text-[#5c6066]">
                  {formatDate(e.date)} · {carLabel(cars, e.carId)}
                </p>
                <p className="truncate text-xs text-[#9a9d96]">
                  {driverName(drivers, e.driverId)}
                  {e.comment ? ` · ${e.comment}` : ''}
                </p>
              </div>
              <IconButton icon="trash" label="Удалить" tone="danger" onClick={() => setConfirmDelete(e)} />
            </div>
          ))}
        </div>
      )}

      {adding && (
        <Sheet
          icon="fuel"
          title="Новый расход"
          subtitle="Топливо, мойка, ТО или штраф"
          onClose={() => setAdding(false)}
          footer={
            <>
              <button onClick={() => setAdding(false)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={save} disabled={!form.carId || !form.amount} className="p-btn p-btn-primary flex-1 py-3 text-xs">
                Сохранить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <SelectField label="Автомобиль" value={form.carId} onChange={(e) => setForm((f) => ({ ...f, carId: e.target.value }))}>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.model} — {c.plate}
                </option>
              ))}
            </SelectField>
            <SelectField label="Водитель" value={form.driverId} onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}>
              {drivers
                .filter((d) => d.role === 'driver')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.lastName} {d.firstName}
                  </option>
                ))}
            </SelectField>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="p-eyebrow mb-1.5 block">Дата</label>
                <input type="date" className="p-input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <Field
                label="Сумма, ₸"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                placeholder="0"
              />
            </div>
            <SelectField
              label="Категория"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <Field
              label="Комментарий"
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder="АЗС Helios, 92"
            />
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить расход?"
          message={`${money(confirmDelete.amount)} · ${confirmDelete.category} от ${formatDate(confirmDelete.date)} будет удалён из сводки.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeExpense(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}
