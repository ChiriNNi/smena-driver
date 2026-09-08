'use client';

import { useMemo, useState } from 'react';
import {
  carLabel,
  daysUntil,
  formatDate,
  REMINDER_KINDS,
  todayISO,
  uid,
  type ProtoReminder,
  type ReminderKind,
} from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, Field, IconButton, Pill, SectionHeader, SelectField, Sheet } from './ui';

// Напоминания по автопарку: ТО, страховка, техосмотр. Сортируются по срочности,
// просроченные подсвечиваются — это то, за чем администратор следит ежедневно.

function statusOf(days: number): { tone: 'bad' | 'warn' | 'good'; label: string } {
  if (days < 0) return { tone: 'bad', label: `просрочено на ${Math.abs(days)} дн.` };
  if (days === 0) return { tone: 'bad', label: 'сегодня' };
  if (days <= 14) return { tone: 'warn', label: `через ${days} дн.` };
  return { tone: 'good', label: `через ${days} дн.` };
}

export default function FleetReminders() {
  const { reminders, cars, addReminder, updateReminder, removeReminder } = useStore();
  const [editing, setEditing] = useState<ProtoReminder | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProtoReminder | null>(null);
  const [form, setForm] = useState({
    carId: cars[0]?.id ?? '',
    kind: REMINDER_KINDS[0] as ReminderKind,
    dueDate: todayISO(),
    note: '',
  });

  const sorted = useMemo(() => [...reminders].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)), [reminders]);
  const overdue = sorted.filter((r) => daysUntil(r.dueDate) < 0).length;
  const soon = sorted.filter((r) => {
    const d = daysUntil(r.dueDate);
    return d >= 0 && d <= 14;
  }).length;

  function openNew() {
    setForm({ carId: cars[0]?.id ?? '', kind: REMINDER_KINDS[0], dueDate: todayISO(), note: '' });
    setEditing('new');
  }

  function openEdit(r: ProtoReminder) {
    setForm({ carId: r.carId, kind: r.kind, dueDate: r.dueDate, note: r.note });
    setEditing(r);
  }

  function save() {
    if (!form.carId || !form.dueDate) return;
    if (editing === 'new') {
      addReminder({ id: uid('r'), carId: form.carId, kind: form.kind, dueDate: form.dueDate, note: form.note.trim() });
    } else if (editing) {
      updateReminder(editing.id, { carId: form.carId, kind: form.kind, dueDate: form.dueDate, note: form.note.trim() });
    }
    setEditing(null);
  }

  return (
    <>
      {(overdue > 0 || soon > 0) && (
        <div className="flex flex-wrap gap-2">
          {overdue > 0 && <Pill tone="bad">Просрочено: {overdue}</Pill>}
          {soon > 0 && <Pill tone="warn">Ближайшие две недели: {soon}</Pill>}
        </div>
      )}

      <SectionHeader
        title={`Напоминания · ${sorted.length}`}
        action={
          <button onClick={openNew} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Добавить
          </button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState icon="bell" title="Напоминаний нет" hint="Добавьте срок ТО, страховки или техосмотра — не придётся держать в голове." />
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((r) => {
            const st = statusOf(daysUntil(r.dueDate));
            return (
              <div key={r.id} className="p-card flex items-center gap-3 p-3.5">
                <div
                  className={
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full ' +
                    (st.tone === 'bad' ? 'bg-[#c0564a]/12 text-[#c0564a]' : st.tone === 'warn' ? 'bg-[#b5811c]/12 text-[#96690f]' : 'bg-[#8fc640]/15 text-[#5e9128]')
                  }
                >
                  <Icon name={r.kind === 'ТО' ? 'wrench' : r.kind === 'Страховка' ? 'shield' : 'clipboard'} size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{r.kind}</p>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <p className="truncate text-xs text-[#5c6066]">
                    {formatDate(r.dueDate)} · {carLabel(cars, r.carId)}
                  </p>
                  {r.note && <p className="truncate text-xs text-[#9a9d96]">{r.note}</p>}
                </div>
                <IconButton icon="pencil" label="Изменить" onClick={() => openEdit(r)} />
                <IconButton icon="trash" label="Удалить" tone="danger" onClick={() => setConfirmDelete(r)} />
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Sheet
          icon="bell"
          title={editing === 'new' ? 'Новое напоминание' : 'Изменить напоминание'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={save} disabled={!form.carId || !form.dueDate} className="p-btn p-btn-primary flex-1 py-3 text-xs">
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
            <SelectField label="Тип" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ReminderKind }))}>
              {REMINDER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </SelectField>
            <div>
              <label className="p-eyebrow mb-1.5 block">Срок</label>
              <input type="date" className="p-input" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <Field label="Заметка" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="ТО-4, пробег 90 000 км" />
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить напоминание?"
          message={`${confirmDelete.kind} на ${formatDate(confirmDelete.dueDate)} больше не будет отслеживаться.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeReminder(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}
