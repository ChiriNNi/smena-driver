'use client';

import { useState } from 'react';
import { buildShiftReportText, SEED_HISTORY, type ProtoDriver, type ProtoShift } from '@/lib/proto-data';
import { Icon } from './icons';

function money(n: number) {
  return n.toLocaleString('ru-RU') + ' ₸';
}

export default function HistoryTab({ driver }: { driver: ProtoDriver }) {
  const [selected, setSelected] = useState<ProtoShift | null>(null);

  function copyReport(shift: ProtoShift) {
    navigator.clipboard?.writeText(buildShiftReportText(driver, shift));
  }

  function sendWhatsApp(shift: ProtoShift) {
    window.open('https://wa.me/?text=' + encodeURIComponent(buildShiftReportText(driver, shift)), '_blank');
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <h2 className="p-eyebrow mb-1">История смен</h2>
      {SEED_HISTORY.map((s, i) => (
        <button
          key={s.id}
          onClick={() => setSelected(s)}
          className="p-card p-fade-up p-4 text-left transition active:scale-[0.99]"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{s.date}</span>
            <span className="text-xs text-[#9a9d96]">{s.timeStart}–{s.timeEnd}</span>
          </div>
          <p className="mt-1 text-xs text-[#5c6066]">{s.car}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7e9e2]">
              <div className="h-full rounded-full bg-[#8fc640]" style={{ width: `${Math.round((s.done / s.total) * 100)}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums text-[#1a1d1e]">{s.done}/{s.total}</span>
          </div>
          <p className="mt-2 text-xs text-[#5c6066]">{s.cashNote}</p>
        </button>
      ))}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1a1d1e]/60 sm:items-center sm:p-6" onClick={() => setSelected(null)}>
          <div
            className="p-fade-up flex max-h-[88vh] w-full flex-col rounded-t-[28px] bg-white sm:max-w-sm sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e7e9e2] px-5 py-4">
              <div>
                <h3 className="text-base font-bold">{selected.date}</h3>
                <p className="text-xs text-[#9a9d96]">{selected.car}</p>
              </div>
              <button onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f6f1] text-[#5c6066] transition hover:bg-[#e7e9e2]">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-card p-4">
                  <div className="flex items-center gap-1.5 text-[#8fc640]"><Icon name="check-circle" size={16} /></div>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums">{selected.done}<span className="text-sm font-semibold text-[#9a9d96]">/{selected.total}</span></p>
                  <p className="p-eyebrow mt-0.5">Чек-лист</p>
                </div>
                <div className="p-card p-4">
                  <div className="flex items-center gap-1.5 text-[#8fc640]"><Icon name="clock" size={16} /></div>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums">{selected.timeEnd}</p>
                  <p className="p-eyebrow mt-0.5">Окончание</p>
                </div>
              </div>

              <div className="p-card mt-3 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name="map" size={16} className="text-[#8fc640]" />Маршрут</div>
                <div className="flex items-center justify-between p-card-line py-2 text-sm"><span className="text-[#5c6066]">Начало</span><span className="font-medium">{selected.placeStart}, {selected.timeStart}</span></div>
                <div className="flex items-center justify-between py-2 text-sm"><span className="text-[#5c6066]">Завершение</span><span className="font-medium">{selected.placeEnd}, {selected.timeEnd}</span></div>
              </div>

              <div className="p-card mt-3 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name="wallet" size={16} className="text-[#8fc640]" />Касса</div>
                <div className="flex items-center justify-between p-card-line py-2 text-sm"><span className="text-[#5c6066]">Начало смены</span><span className="font-medium tabular-nums">{money(selected.cashStart)}</span></div>
                <div className="flex items-center justify-between p-card-line py-2 text-sm"><span className="text-[#5c6066]">Расходы</span><span className="font-medium tabular-nums">{money(selected.cashExpenses)}</span></div>
                <div className="flex items-center justify-between p-card-line py-2 text-sm"><span className="text-[#5c6066]">Штрафы</span><span className="font-medium tabular-nums">{money(selected.cashFines)}</span></div>
                <div className="flex items-center justify-between py-2 text-sm font-bold"><span>Итог смены</span><span className="tabular-nums text-[#5e9128]">{money(selected.cashEnd)}</span></div>
              </div>

              {selected.remarks.length > 0 && (
                <div className="p-card mt-3 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name="warning" size={16} className="text-[#8fc640]" />Замечания</div>
                  <div className="flex flex-col gap-2">
                    {selected.remarks.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-2xl bg-white p-2.5 text-sm ring-1 ring-inset ring-[#e7e9e2]">
                        {r.hasPhoto && <Icon name="camera" size={15} className="shrink-0 text-[#9a9d96]" />}
                        <span>{r.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#e7e9e2] px-5 py-4">
              <button onClick={() => copyReport(selected)} className="p-btn p-btn-outline flex-1 py-3 text-xs">Скопировать</button>
              <button onClick={() => sendWhatsApp(selected)} className="p-btn p-btn-primary flex-1 py-3 text-xs">В WhatsApp</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
