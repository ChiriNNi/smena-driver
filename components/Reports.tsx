'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/client-api';
import { fmtKzt } from '@/lib/shared-calc';

type ReportData = {
  from: string | null; to: string | null;
  kpi: { shifts: number; km: number; expenses: number; fines: number };
  compliance: number;
  daily: { date: string; expenses: number; fines: number }[];
  byDriver: { driver_name: string; shifts: number; km: number; expenses: number; fines: number; compliance: number }[];
  byCategory: { category: string; amount: number; percent: number }[];
  reminders: { type: string; due_date: string; driver_name: string | null; note: string | null; status: string }[];
};

const PERIODS = [
  { id: 'all', label: 'Всё время' },
  { id: 'month', label: 'Этот месяц' },
  { id: '30d', label: '30 дней' },
  { id: '7d', label: '7 дней' },
  { id: 'custom', label: 'Период' },
] as const;

const STATUS_DOT: Record<string, string> = { ok: '🟢', soon: '🟡', over: '🔴' };

export default function Reports() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportData | null>(null);

  async function load() {
    const params = new URLSearchParams({ period });
    if (period === 'custom') { if (from) params.set('from', from); if (to) params.set('to', to); }
    const d = await apiGet<ReportData>(`/api/reports?${params}`);
    setData(d);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- перезагрузка отчёта при смене периода
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  function exportUrl(kind: 'csv' | 'xlsx') {
    const params = new URLSearchParams({ period });
    if (period === 'custom') { if (from) params.set('from', from); if (to) params.set('to', to); }
    return `/api/export/${kind}?${params}`;
  }

  const maxDaily = data ? Math.max(1, ...data.daily.map((d) => d.expenses + d.fines)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${period === p.id ? 'bg-amber-500 text-neutral-950' : 'border border-neutral-700 text-neutral-400'}`}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
            <button onClick={load} className="btn-outline">Применить</button>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <a href={exportUrl('csv')} className="btn-outline">CSV</a>
          <a href={exportUrl('xlsx')} className="btn-gold px-4 py-2">Excel</a>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Смен" value={String(data.kpi.shifts)} />
            <Kpi label="Километры" value={data.kpi.km.toLocaleString('ru-RU')} />
            <Kpi label="Расходы" value={fmtKzt(data.kpi.expenses)} />
            <Kpi label="Штрафы" value={fmtKzt(data.kpi.fines)} />
          </div>

          <div className="card p-4">
            <p className="text-sm text-neutral-400">Соблюдение чек-листов</p>
            <p className="text-2xl font-semibold text-amber-400">{data.compliance}%</p>
          </div>

          <div className="card overflow-x-auto p-4">
            <p className="mb-3 text-sm font-semibold">Расходы и штрафы по дням</p>
            <div className="flex h-32 items-end gap-1" style={{ minWidth: Math.max(300, data.daily.length * 24) }}>
              {data.daily.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={d.date}>
                  <div className="w-full bg-red-500/70" style={{ height: `${(d.fines / maxDaily) * 100}%` }} />
                  <div className="w-full bg-amber-500/70" style={{ height: `${(d.expenses / maxDaily) * 100}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-x-auto p-4">
            <p className="mb-3 text-sm font-semibold">Статистика по водителям</p>
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="pb-2">Водитель</th><th className="pb-2">Смены</th><th className="pb-2">Км</th><th className="pb-2">Расходы</th><th className="pb-2">Штрафы</th><th className="pb-2">% чек-листа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {data.byDriver.map((d) => (
                  <tr key={d.driver_name}>
                    <td className="py-2">{d.driver_name}</td><td>{d.shifts}</td><td>{d.km.toLocaleString('ru-RU')}</td>
                    <td>{fmtKzt(d.expenses)}</td><td>{fmtKzt(d.fines)}</td><td>{d.compliance}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-4">
            <p className="mb-3 text-sm font-semibold">Расходы по категориям</p>
            <div className="flex flex-col gap-2">
              {data.byCategory.map((c) => (
                <div key={c.category} className="flex items-center gap-2 text-sm">
                  <span className="w-40 flex-shrink-0 text-neutral-300">{c.category}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full bg-amber-500" style={{ width: `${c.percent}%` }} />
                  </div>
                  <span className="w-24 flex-shrink-0 text-right text-neutral-400">{fmtKzt(c.amount)} ({c.percent}%)</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <p className="mb-3 text-sm font-semibold">Сроки ТО и документов</p>
            <div className="flex flex-col gap-1 text-sm">
              {data.reminders.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span>{STATUS_DOT[r.status]}</span>
                  <span className="flex-1">{r.type} — {r.driver_name || 'без привязки'}</span>
                  <span className="text-neutral-500">{r.due_date}</span>
                </div>
              ))}
              {data.reminders.length === 0 && <p className="text-neutral-500">Нет напоминаний.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-100">{value}</p>
    </div>
  );
}
