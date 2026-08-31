'use client';

import { useEffect, useState } from 'react';
import type { Driver } from '@/lib/types';
import { apiGet, apiSend } from '@/lib/client-api';
import { fmtKzt } from '@/lib/shared-calc';

type ShiftRow = {
  id: string;
  driver_name_cache: string | null;
  date_iso: string;
  time_start: string | null;
  time_end: string | null;
  place_start: string | null;
  place_end: string | null;
  cars: string[];
  checklist_done: number;
  checklist_total: number;
  summary_text: string | null;
  discrepancy: number;
  compliance: number;
};

export default function HistoryPanel({ drivers, isAdmin, onClose }: { drivers: Driver[]; isAdmin: boolean; onClose: () => void }) {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [q, setQ] = useState('');
  const [driverId, setDriverId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (driverId) params.set('driverId', driverId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const data = await apiGet<{ shifts: ShiftRow[] }>(`/api/shifts?${params}`);
    setShifts(data.shifts);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка истории при открытии панели
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function del(id: string) {
    if (!confirm('Удалить эту смену из истории?')) return;
    await apiSend(`/api/shifts?id=${id}`, 'DELETE');
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={onClose}>
      <div className="mt-6 w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">История смен</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">✕</button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} className="input col-span-2 sm:col-span-1" />
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input">
            <option value="">Все водители</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
        <button onClick={load} className="btn-outline mb-3 w-full">Применить фильтр</button>

        {loading ? (
          <p className="text-sm text-neutral-500">Загрузка…</p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-neutral-500">Смен не найдено.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {shifts.map((s) => (
              <div key={s.id} className="card p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.date_iso.split('-').reverse().join('.')} — {s.driver_name_cache || '—'}</span>
                  <span className="text-xs text-neutral-500">{s.checklist_done}/{s.checklist_total} ({s.compliance}%)</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {s.time_start || '—'}–{s.time_end || '—'} · {s.cars.join(', ') || '—'} · Расхождение: {fmtKzt(s.discrepancy)}
                </p>
                <div className="mt-2 flex gap-3 text-xs">
                  <button onClick={() => setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }))} className="text-amber-400 hover:underline">
                    {expanded[s.id] ? 'Скрыть' : 'Подробнее'}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(s.summary_text || '')} className="text-neutral-400 hover:underline">Копировать</button>
                  {isAdmin && <button onClick={() => del(s.id)} className="text-red-400 hover:underline">Удалить</button>}
                </div>
                {expanded[s.id] && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-neutral-950 p-2 text-xs text-neutral-300">{s.summary_text}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
