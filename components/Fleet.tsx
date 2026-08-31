'use client';

import { useEffect, useState } from 'react';
import type { Driver } from '@/lib/types';
import { ApiError, apiGet, apiSend } from '@/lib/client-api';
import { EXPENSE_CATS, REMINDER_TYPES, fmtKzt } from '@/lib/shared-calc';
import { compressImageToDataURL } from '@/lib/compress-image';

type Sub = 'drivers' | 'mileage' | 'expenses' | 'schedule' | 'reminders';

const SUBS: { id: Sub; label: string }[] = [
  { id: 'drivers', label: '👤 Водители' },
  { id: 'mileage', label: '🛣️ Пробег' },
  { id: 'expenses', label: '💵 Расходы' },
  { id: 'schedule', label: '📅 График' },
  { id: 'reminders', label: '🔔 Напоминания' },
];

type MileageRow = { id: string; driver_name: string | null; car: string; odo_start: string; odo_end: string; date_iso: string };
type ExpenseRow = { id: string; driver_name: string | null; category: string; amount: string; receipt_url: string | null; date_iso: string };
type ScheduleRow = { id: string; driver_name: string | null; time_start: string | null; time_end: string | null; car: string | null; note: string | null; date_iso: string };
type ReminderRow = { id: string; type: string; driver_name: string | null; due_date: string; note: string | null; status: string };

function reportError(e: unknown) {
  alert(e instanceof ApiError || e instanceof Error ? e.message : 'Ошибка запроса.');
}

export default function Fleet({ drivers, isAdmin, onDriversChanged }: { drivers: Driver[]; isAdmin: boolean; onDriversChanged: () => void }) {
  const [sub, setSub] = useState<Sub>('drivers');
  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {SUBS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${sub === s.id ? 'bg-amber-500 text-neutral-950' : 'border border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'drivers' && <DriversTab drivers={drivers} isAdmin={isAdmin} onChanged={onDriversChanged} />}
      {sub === 'mileage' && <MileageTab drivers={drivers} isAdmin={isAdmin} />}
      {sub === 'expenses' && <ExpensesTab drivers={drivers} isAdmin={isAdmin} />}
      {sub === 'schedule' && <ScheduleTab drivers={drivers} isAdmin={isAdmin} />}
      {sub === 'reminders' && <RemindersTab drivers={drivers} isAdmin={isAdmin} />}
    </div>
  );
}

function DriversTab({ drivers, isAdmin, onChanged }: { drivers: Driver[]; isAdmin: boolean; onChanged: () => void }) {
  const [name, setName] = useState('');
  async function add() {
    if (!name.trim()) return;
    try { await apiSend('/api/drivers', 'POST', { name: name.trim() }); setName(''); onChanged(); } catch (e) { reportError(e); }
  }
  async function remove(id: string) {
    if (!confirm('Удалить водителя? Записи в журналах сохранятся без привязки.')) return;
    await apiSend(`/api/drivers?id=${id}`, 'DELETE');
    onChanged();
  }
  return (
    <div className="card p-4">
      {isAdmin && (
        <div className="mb-4 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО водителя" className="input" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button onClick={add} className="btn-gold px-4">+ Добавить</button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {drivers.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm">
            <span>{d.name}</span>
            {isAdmin && <button onClick={() => remove(d.id)} className="text-red-400 hover:underline">✕</button>}
          </div>
        ))}
        {drivers.length === 0 && <p className="text-sm text-neutral-500">Пока нет ни одного водителя.</p>}
      </div>
    </div>
  );
}

function MileageTab({ drivers, isAdmin }: { drivers: Driver[]; isAdmin: boolean }) {
  const [rows, setRows] = useState<MileageRow[]>([]);
  const [form, setForm] = useState({ driverId: '', car: '', odoStart: '', odoEnd: '', date: new Date().toISOString().slice(0, 10) });

  async function load() {
    const data = await apiGet<{ mileage: MileageRow[] }>('/api/fleet/mileage');
    setRows(data.mileage);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка списка при открытии вкладки
    load();
  }, []);

  async function add() {
    try {
      await apiSend('/api/fleet/mileage', 'POST', form);
      setForm({ ...form, odoStart: '', odoEnd: '' });
      load();
    } catch (e) { reportError(e); }
  }
  async function del(id: string) { await apiSend(`/api/fleet/mileage?id=${id}`, 'DELETE'); load(); }
  const total = rows.reduce((s, r) => s + (Number(r.odo_end) - Number(r.odo_start)), 0);
  return (
    <div className="card p-4">
      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} className="input">
            <option value="">Водитель</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input placeholder="Авто" value={form.car} onChange={(e) => setForm({ ...form, car: e.target.value })} className="input" />
          <input type="number" placeholder="Начало" value={form.odoStart} onChange={(e) => setForm({ ...form, odoStart: e.target.value })} className="input" />
          <input type="number" placeholder="Конец" value={form.odoEnd} onChange={(e) => setForm({ ...form, odoEnd: e.target.value })} className="input" />
          <div className="flex gap-2">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
            <button onClick={add} className="btn-gold px-3">+</button>
          </div>
        </div>
      )}
      <p className="mb-2 text-sm text-neutral-400">Итого: {total.toLocaleString('ru-RU')} км</p>
      <Table
        head={['Дата', 'Водитель', 'Авто', 'Км', isAdmin ? '' : undefined].filter((h): h is string => h !== undefined)}
        rows={rows.map((r) => [
          r.date_iso, r.driver_name || '—', r.car, (Number(r.odo_end) - Number(r.odo_start)).toLocaleString('ru-RU'),
          isAdmin ? <button key="d" onClick={() => del(r.id)} className="text-red-400">✕</button> : null,
        ])}
      />
    </div>
  );
}

function ExpensesTab({ drivers, isAdmin }: { drivers: Driver[]; isAdmin: boolean }) {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [form, setForm] = useState({ driverId: '', category: EXPENSE_CATS[0] as string, amount: '', title: '', date: new Date().toISOString().slice(0, 10) });
  const [receipt, setReceipt] = useState<string>('');

  async function load() {
    const data = await apiGet<{ expenses: ExpenseRow[] }>('/api/fleet/expenses');
    setRows(data.expenses);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка списка при открытии вкладки
    load();
  }, []);

  async function add() {
    try {
      await apiSend('/api/fleet/expenses', 'POST', { ...form, receiptUrl: receipt || undefined });
      setForm({ ...form, amount: '', title: '' });
      setReceipt('');
      load();
    } catch (e) { reportError(e); }
  }
  async function del(id: string) { await apiSend(`/api/fleet/expenses?id=${id}`, 'DELETE'); load(); }
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <div className="card p-4">
      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
          <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} className="input">
            <option value="">Водитель</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
            {EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Сумма" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" />
          <input placeholder="Описание" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
          <div className="flex gap-2">
            <label className="btn-outline flex-1 cursor-pointer text-center">
              📎
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setReceipt(await compressImageToDataURL(f)); }} />
            </label>
            <button onClick={add} className="btn-gold px-3">+</button>
          </div>
        </div>
      )}
      <p className="mb-2 text-sm text-neutral-400">Итого: {fmtKzt(total)}</p>
      <Table
        head={['Дата', 'Водитель', 'Категория', 'Сумма', 'Чек', isAdmin ? '' : undefined].filter((h): h is string => h !== undefined)}
        rows={rows.map((r) => [
          r.date_iso, r.driver_name || '—', r.category, fmtKzt(Number(r.amount)),
          r.receipt_url ? <a key="r" href={r.receipt_url} target="_blank" className="text-amber-400">Фото</a> : '—',
          isAdmin ? <button key="d" onClick={() => del(r.id)} className="text-red-400">✕</button> : null,
        ])}
      />
    </div>
  );
}

function ScheduleTab({ drivers, isAdmin }: { drivers: Driver[]; isAdmin: boolean }) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [form, setForm] = useState({ driverId: '', date: new Date().toISOString().slice(0, 10), timeStart: '', timeEnd: '', car: '', note: '' });

  async function load() {
    const data = await apiGet<{ schedule: ScheduleRow[] }>('/api/fleet/schedule');
    setRows(data.schedule);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка списка при открытии вкладки
    load();
  }, []);

  async function add() {
    try { await apiSend('/api/fleet/schedule', 'POST', form); load(); } catch (e) { reportError(e); }
  }
  async function del(id: string) { await apiSend(`/api/fleet/schedule?id=${id}`, 'DELETE'); load(); }
  return (
    <div className="card p-4">
      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
          <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} className="input">
            <option value="">Водитель</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
          <input type="time" value={form.timeStart} onChange={(e) => setForm({ ...form, timeStart: e.target.value })} className="input" />
          <input type="time" value={form.timeEnd} onChange={(e) => setForm({ ...form, timeEnd: e.target.value })} className="input" />
          <input placeholder="Авто" value={form.car} onChange={(e) => setForm({ ...form, car: e.target.value })} className="input" />
          <div className="flex gap-2">
            <input placeholder="Заметка" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
            <button onClick={add} className="btn-gold px-3">+</button>
          </div>
        </div>
      )}
      <Table
        head={['Дата', 'Водитель', 'Время', 'Авто', 'Заметка', isAdmin ? '' : undefined].filter((h): h is string => h !== undefined)}
        rows={rows.map((r) => [
          r.date_iso, r.driver_name || '—', `${r.time_start || '—'}–${r.time_end || '—'}`, r.car || '—', r.note || '—',
          isAdmin ? <button key="d" onClick={() => del(r.id)} className="text-red-400">✕</button> : null,
        ])}
      />
    </div>
  );
}

const STATUS_DOT: Record<string, string> = { ok: '🟢', soon: '🟡', over: '🔴' };

function RemindersTab({ drivers, isAdmin }: { drivers: Driver[]; isAdmin: boolean }) {
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [form, setForm] = useState({ driverId: '', type: REMINDER_TYPES[0] as string, dueDate: '', note: '' });

  async function load() {
    const data = await apiGet<{ reminders: ReminderRow[] }>('/api/fleet/reminders');
    setRows(data.reminders);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка списка при открытии вкладки
    load();
  }, []);

  async function add() {
    try { await apiSend('/api/fleet/reminders', 'POST', form); load(); } catch (e) { reportError(e); }
  }
  async function del(id: string) { await apiSend(`/api/fleet/reminders?id=${id}`, 'DELETE'); load(); }
  return (
    <div className="card p-4">
      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} className="input">
            <option value="">Без привязки</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
            {REMINDER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input" />
          <input placeholder="Заметка" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
          <button onClick={add} className="btn-gold">+ Добавить</button>
        </div>
      )}
      <Table
        head={['', 'Тип', 'Водитель', 'Срок', 'Заметка', isAdmin ? '' : undefined].filter((h): h is string => h !== undefined)}
        rows={rows.map((r) => [
          STATUS_DOT[r.status], r.type, r.driver_name || '—', r.due_date, r.note || '—',
          isAdmin ? <button key="d" onClick={() => del(r.id)} className="text-red-400">✕</button> : null,
        ])}
      />
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <p className="text-sm text-neutral-500">Нет записей.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            {head.map((h, i) => <th key={i} className="pb-2 pr-3 font-normal">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => <td key={ci} className="py-2 pr-3">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
