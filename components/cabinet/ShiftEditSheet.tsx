'use client';

import { useState } from 'react';
import type { ShiftPatch } from '@/lib/api';
import { money } from '@/lib/labels';
import { cashBalance, type Shift } from '@/lib/model';
import { Field, Sheet } from './ui';

// Исправление сданной смены администратором.
//
// Водитель ошибается: перепутал цифры в кассе, снял показания не с того
// счётчика, записал расход в приход. Раньше исправить это было нельзя вообще —
// смена оставалась в истории и в выгрузке с неверными числами. Теперь можно, но
// смена помечается как исправленная и видно, кто это сделал.
//
// Снимок чек-листа здесь не меняется никогда: отметки и замечания — это то, что
// водитель подтвердил сам, и правки администратора им не касаются.

const digits = (v: string) => v.replace(/\D/g, '');

export default function ShiftEditSheet({
  shift,
  onClose,
  onSave,
}: {
  shift: Shift;
  onClose: () => void;
  onSave: (patch: ShiftPatch) => Promise<void>;
}) {
  const [form, setForm] = useState({
    date: shift.date,
    timeStart: shift.timeStart,
    timeEnd: shift.timeEnd,
    placeStart: shift.placeStart,
    placeEnd: shift.placeEnd,
    cashStart: String(shift.cashStart),
    cashIncome: String(shift.cashIncome),
    cashIncomeNote: shift.cashIncomeNote,
    cashExpenses: String(shift.cashExpenses),
    cashExpensesNote: shift.cashExpensesNote,
    cashFines: String(shift.cashFines),
    odoStart: String(shift.odoStart),
    odoEnd: String(shift.odoEnd),
  });
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const facts = {
    cashStart: Number(form.cashStart) || 0,
    cashIncome: Number(form.cashIncome) || 0,
    cashExpenses: Number(form.cashExpenses) || 0,
    cashFines: Number(form.cashFines) || 0,
  };
  const balance = cashBalance(facts);
  const odoStart = Number(form.odoStart) || 0;
  const odoEnd = Number(form.odoEnd) || 0;

  const problem =
    balance < 0
      ? 'Расход и штрафы больше, чем было в кассе с приходом.'
      : odoEnd > 0 && odoEnd < odoStart
        ? 'Одометр на конец меньше, чем на начало.'
        : '';

  async function save() {
    if (problem) return;
    setSaving(true);
    try {
      await onSave({
        date: form.date,
        timeStart: form.timeStart,
        timeEnd: form.timeEnd,
        placeStart: form.placeStart.trim(),
        placeEnd: form.placeEnd.trim(),
        ...facts,
        cashIncomeNote: form.cashIncomeNote.trim(),
        cashExpensesNote: form.cashExpensesNote.trim(),
        odoStart,
        odoEnd,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      icon="pencil"
      title="Исправить смену"
      subtitle={`${shift.driverLabel} · ${shift.carLabel}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="p-btn p-btn-outline flex-1 py-3 text-xs">
            Отмена
          </button>
          <button onClick={save} disabled={saving || !!problem} className="p-btn p-btn-primary flex-1 py-3 text-xs">
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl border border-dashed border-[#e7e9e2] bg-[#f5f6f1] p-3 text-[11px] leading-relaxed text-[#5c6066]">
          Смена останется в истории с пометкой «исправлена» и вашим именем. Отметки чек-листа и замечания водителя не
          меняются.
        </p>

        <Field label="Дата" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало" type="time" value={form.timeStart} onChange={(e) => set({ timeStart: e.target.value })} />
          <Field label="Завершение" type="time" value={form.timeEnd} onChange={(e) => set({ timeEnd: e.target.value })} />
        </div>

        <Field label="Место начала" value={form.placeStart} onChange={(e) => set({ placeStart: e.target.value })} />
        <Field label="Место завершения" value={form.placeEnd} onChange={(e) => set({ placeEnd: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Касса на начало, ₸"
            inputMode="numeric"
            value={form.cashStart}
            onChange={(e) => set({ cashStart: digits(e.target.value) })}
          />
          <Field
            label="Приход, ₸"
            inputMode="numeric"
            value={form.cashIncome}
            onChange={(e) => set({ cashIncome: digits(e.target.value) })}
          />
        </div>
        <Field label="От кого приход" value={form.cashIncomeNote} onChange={(e) => set({ cashIncomeNote: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Расход, ₸"
            inputMode="numeric"
            value={form.cashExpenses}
            onChange={(e) => set({ cashExpenses: digits(e.target.value) })}
          />
          <Field
            label="Штрафы, ₸"
            inputMode="numeric"
            value={form.cashFines}
            onChange={(e) => set({ cashFines: digits(e.target.value) })}
          />
        </div>
        <Field label="На что расход" value={form.cashExpensesNote} onChange={(e) => set({ cashExpensesNote: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Одометр начало"
            inputMode="numeric"
            value={form.odoStart}
            onChange={(e) => set({ odoStart: digits(e.target.value) })}
          />
          <Field
            label="Одометр конец"
            inputMode="numeric"
            value={form.odoEnd}
            onChange={(e) => set({ odoEnd: digits(e.target.value) })}
          />
        </div>

        {/* Остаток пересчитывается на глазах: администратор видит результат
            правки до сохранения, а не после. */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f5f6f1] px-3.5 py-3 text-sm font-bold">
          <span>Остаток на конец</span>
          <span className={'tabular-nums ' + (balance < 0 ? 'text-[#c0564a]' : 'text-[#5e9128]')}>{money(balance)}</span>
        </div>

        {problem && <p className="text-[11px] leading-relaxed font-semibold text-[#c0564a]">{problem}</p>}
      </div>
    </Sheet>
  );
}
