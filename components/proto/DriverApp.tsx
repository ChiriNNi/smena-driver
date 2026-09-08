'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { itemKey, type ChecklistPhase } from '@/lib/checklist-data';
import { buildWhatsAppSummary, CARS, nowHHMM, type NoteEntry, type ProtoDriver } from '@/lib/proto-data';
import ChecklistPhaseView from './ChecklistPhaseView';
import HistoryTab from './HistoryTab';
import ProfileTab from './ProfileTab';
import ShiftInfoCard from './ShiftInfoCard';
import BottomNav from './BottomNav';
import { Icon, phaseIconName } from './icons';

type Tab = 'checklist' | 'history' | 'profile';

// Короткие подписи фаз для узкого экрана — «Начало смены» не влезает в треть
// ширины без переноса, а слово «смены» и так понятно из контекста вкладки.
const SHORT_PHASE_LABEL: Record<string, string> = { start: 'Начало', process: 'Процесс', end: 'Завершение' };

function money(v: string) {
  return (Number(v) || 0).toLocaleString('ru-RU') + ' ₸';
}

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="p-eyebrow mb-1.5 block">{label}</label>
      <input className="p-input text-sm" {...props} />
    </div>
  );
}

export default function DriverApp({
  driver,
  checklist,
  onLogout,
}: {
  driver: ProtoDriver;
  checklist: ChecklistPhase[];
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>('checklist');
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, NoteEntry>>({});
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const pagerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Данные начала/завершения смены — как в старой панели «Данные смены»,
  // только по одной карточке в соответствующей фазе вместо одной большой формы.
  const [startDraft, setStartDraft] = useState({ place: '', time: '', car: driver.car, cashStart: '' });
  const [startConfirmed, setStartConfirmed] = useState(false);
  const [endDraft, setEndDraft] = useState({ place: '', time: '', cashEnd: '', cashExpenses: '', cashFines: '' });
  const [endConfirmed, setEndConfirmed] = useState(false);

  // Время по умолчанию проставляем только на клиенте после монтирования —
  // иначе строка "HH:MM" в SSR-рендере разъедется с клиентской гидратацией.
  useEffect(() => {
    const t = nowHHMM();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- одноразовая подстановка текущего времени после монтирования, чтобы не разъехаться с SSR
    setStartDraft((d) => (d.time ? d : { ...d, time: t }));
    setEndDraft((d) => (d.time ? d : { ...d, time: t }));
  }, []);

  const totalItems = useMemo(
    () => checklist.reduce((sum, ph) => sum + ph.sections.reduce((s, sec) => s + sec.items.length, 0), 0),
    [checklist]
  );
  const doneItems = Object.values(checked).filter(Boolean).length;
  const progress = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  function toggle(key: string) {
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }

  function goToPhase(i: number) {
    setPhaseIdx(i);
    pagerRef.current?.scrollTo({ left: i * pagerRef.current.clientWidth, behavior: 'smooth' });
    // При переходе кнопкой «Далее» открываем новую фазу сверху — иначе
    // остаёшься на том же вертикальном скролле, где был в конце предыдущей.
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onScrollPager() {
    const el = pagerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== phaseIdx) setPhaseIdx(i);
  }

  const shiftDate = new Date().toLocaleDateString('ru-RU');
  const summaryText = buildWhatsAppSummary(
    driver, doneItems, totalItems, shiftDate,
    startConfirmed ? startDraft : undefined,
    endConfirmed ? endDraft : undefined
  );

  function copySummary() {
    navigator.clipboard?.writeText(summaryText);
  }

  function sendWhatsApp() {
    window.open('https://wa.me/?text=' + encodeURIComponent(summaryText), '_blank');
  }

  // Собираем замечания из заметок к пунктам чек-листа для итогового отчёта.
  const remarks = useMemo(() => {
    const list: { text: string; comment: string; photos: number }[] = [];
    checklist.forEach((ph) => {
      ph.sections.forEach((section) => {
        section.items.forEach((item, idx) => {
          const note = notes[itemKey(ph.id, section.id, idx)];
          if (note && (note.comment.trim() || note.photos.length > 0)) {
            list.push({ text: item.text, comment: note.comment, photos: note.photos.length });
          }
        });
      });
    });
    return list;
  }, [checklist, notes]);

  const startDisabled = !startDraft.place.trim() || !startDraft.time;

  const startFields = (
    <>
      <Field
        label="Место начала смены"
        value={startDraft.place}
        onChange={(e) => setStartDraft((d) => ({ ...d, place: e.target.value }))}
        placeholder="Офис, Алматы"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Время"
          type="time"
          value={startDraft.time}
          onChange={(e) => setStartDraft((d) => ({ ...d, time: e.target.value }))}
        />
        <Field
          label="Касса, ₸"
          inputMode="numeric"
          value={startDraft.cashStart}
          onChange={(e) => setStartDraft((d) => ({ ...d, cashStart: e.target.value.replace(/\D/g, '') }))}
          placeholder="0"
        />
      </div>
      <div>
        <label className="p-eyebrow mb-1.5 block">Автомобиль</label>
        <select
          className="p-input text-sm"
          value={startDraft.car}
          onChange={(e) => setStartDraft((d) => ({ ...d, car: e.target.value }))}
        >
          {CARS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </>
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e7e9e2] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-sm font-bold text-[#5e9128]">
            {driver.firstName[0]}{driver.lastName[0]}
          </div>
          <div>
            <div className="text-sm font-semibold">{driver.lastName} {driver.firstName}</div>
            <div className="text-xs text-[#9a9d96]">{startConfirmed ? startDraft.car : driver.car}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#5c6066]">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-[#f0f1ec]">
            <div className="h-full rounded-full bg-[#8fc640] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="tabular-nums font-semibold text-[#1a1d1e]">{progress}%</span>
        </div>
      </header>

      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto pb-24">
        {tab === 'checklist' && !startConfirmed && (
          <div className="px-5 py-8">
            <div className="p-fade-up mx-auto mb-6 max-w-xs text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
                <Icon name="map" size={22} />
              </div>
              <h2 className="text-lg font-bold">Начало смены</h2>
              <p className="mt-1.5 text-sm text-[#5c6066]">Зафиксируйте место, время и кассу — после этого откроется чек-лист</p>
            </div>
            <ShiftInfoCard
              icon="map"
              title="Данные начала смены"
              confirmed={false}
              summary=""
              confirmLabel="Начать смену"
              confirmDisabled={startDisabled}
              onConfirm={() => setStartConfirmed(true)}
              onEdit={() => {}}
            >
              {startFields}
            </ShiftInfoCard>
          </div>
        )}

        {tab === 'checklist' && startConfirmed && (
          <>
            <div className="grid grid-cols-3 gap-2 border-b border-[#e7e9e2] bg-[#f5f6f1] px-3 py-3">
              {checklist.map((ph, i) => (
                <button
                  key={ph.id}
                  onClick={() => goToPhase(i)}
                  className={
                    'p-btn flex items-center justify-center gap-1 whitespace-nowrap px-2 py-2 text-[11px] ' +
                    (i === phaseIdx
                      ? 'p-btn-primary'
                      : 'bg-white text-[#5c6066] ring-1 ring-inset ring-[#e7e9e2] hover:text-[#1a1d1e] hover:ring-[#d7dacf]')
                  }
                >
                  <Icon name={phaseIconName(ph.id)} size={14} className="shrink-0" />
                  {SHORT_PHASE_LABEL[ph.id] ?? ph.phase}
                </button>
              ))}
            </div>

            <div className="px-4 pt-4">
              <ShiftInfoCard
                icon="map"
                title="Данные начала смены"
                confirmed={true}
                summary={`${startDraft.time}, ${startDraft.place || 'место не указано'} · ${startDraft.car}`}
                confirmLabel="Начать смену"
                confirmDisabled={startDisabled}
                onConfirm={() => setStartConfirmed(true)}
                onEdit={() => setStartConfirmed(false)}
              >
                {startFields}
              </ShiftInfoCard>
            </div>

            <div ref={pagerRef} onScroll={onScrollPager} className="pager flex overflow-x-auto">
              {checklist.map((ph, i) => (
                <ChecklistPhaseView
                  key={ph.id}
                  phase={ph}
                  checked={checked}
                  onToggle={toggle}
                  notes={notes}
                  openNoteKey={openNoteKey}
                  onOpenNote={setOpenNoteKey}
                  onNoteChange={(key, entry) => setNotes((n) => ({ ...n, [key]: entry }))}
                  footerExtra={
                    ph.id === 'end' ? (
                      <ShiftInfoCard
                        icon="wallet"
                        title="Данные завершения смены"
                        confirmed={endConfirmed}
                        summary={`${endDraft.time}, ${endDraft.place || 'место не указано'}`}
                        confirmLabel="Завершить смену"
                        confirmDisabled={!endDraft.place.trim() || !endDraft.time}
                        onConfirm={() => { setEndConfirmed(true); setFinished(true); }}
                        onEdit={() => setEndConfirmed(false)}
                      >
                        <Field
                          label="Место завершения смены"
                          value={endDraft.place}
                          onChange={(e) => setEndDraft((d) => ({ ...d, place: e.target.value }))}
                          placeholder="Офис, Алматы"
                        />
                        <Field
                          label="Время"
                          type="time"
                          value={endDraft.time}
                          onChange={(e) => setEndDraft((d) => ({ ...d, time: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            label="Касса, ₸"
                            inputMode="numeric"
                            value={endDraft.cashEnd}
                            onChange={(e) => setEndDraft((d) => ({ ...d, cashEnd: e.target.value.replace(/\D/g, '') }))}
                            placeholder="0"
                          />
                          <Field
                            label="Расходы, ₸"
                            inputMode="numeric"
                            value={endDraft.cashExpenses}
                            onChange={(e) => setEndDraft((d) => ({ ...d, cashExpenses: e.target.value.replace(/\D/g, '') }))}
                            placeholder="0"
                          />
                        </div>
                        <Field
                          label="Штрафы, ₸"
                          inputMode="numeric"
                          value={endDraft.cashFines}
                          onChange={(e) => setEndDraft((d) => ({ ...d, cashFines: e.target.value.replace(/\D/g, '') }))}
                          placeholder="0"
                        />
                      </ShiftInfoCard>
                    ) : (
                      <button
                        onClick={() => goToPhase(i + 1)}
                        className="p-btn p-btn-primary flex items-center justify-center gap-1.5 py-3.5"
                      >
                        Далее<Icon name="chevron-up" size={15} className="rotate-90" />
                      </button>
                    )
                  }
                />
              ))}
            </div>
          </>
        )}

        {tab === 'history' && <HistoryTab driver={driver} />}
        {tab === 'profile' && <ProfileTab driver={driver} onLogout={onLogout} />}
      </main>

      <BottomNav
        items={[
          { id: 'checklist', icon: 'clipboard', label: 'Чек-лист' },
          { id: 'history', icon: 'clock', label: 'История' },
          { id: 'profile', icon: 'user', label: 'Профиль' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {finished && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1a1d1e]/60 sm:items-center sm:p-6" onClick={() => setFinished(false)}>
          <div
            className="p-fade-up flex max-h-[88vh] w-full flex-col rounded-t-[28px] bg-white sm:max-w-sm sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[#e7e9e2] px-5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
                <Icon name="check-circle" size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold">Смена завершена</h3>
                <p className="text-xs text-[#9a9d96]">{shiftDate} · {startDraft.car}</p>
              </div>
              <button onClick={() => setFinished(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f6f1] text-[#5c6066] transition hover:bg-[#e7e9e2]">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-card p-4">
                  <div className="text-[#8fc640]"><Icon name="check-circle" size={16} /></div>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums">{doneItems}<span className="text-sm font-semibold text-[#9a9d96]">/{totalItems}</span></p>
                  <p className="p-eyebrow mt-0.5">Чек-лист</p>
                </div>
                <div className="p-card p-4">
                  <div className="text-[#8fc640]"><Icon name="clock" size={16} /></div>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums">{endDraft.time}</p>
                  <p className="p-eyebrow mt-0.5">Окончание</p>
                </div>
              </div>

              <div className="p-card mt-3 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name="map" size={16} className="text-[#8fc640]" />Маршрут</div>
                <div className="p-card-line flex items-center justify-between py-2 text-sm"><span className="text-[#5c6066]">Начало</span><span className="font-medium">{startDraft.place}, {startDraft.time}</span></div>
                <div className="flex items-center justify-between py-2 text-sm"><span className="text-[#5c6066]">Завершение</span><span className="font-medium">{endDraft.place}, {endDraft.time}</span></div>
              </div>

              <div className="p-card mt-3 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name="wallet" size={16} className="text-[#8fc640]" />Касса</div>
                <div className="p-card-line flex items-center justify-between py-2 text-sm"><span className="text-[#5c6066]">Начало смены</span><span className="font-medium tabular-nums">{money(startDraft.cashStart)}</span></div>
                <div className="p-card-line flex items-center justify-between py-2 text-sm"><span className="text-[#5c6066]">Расходы</span><span className="font-medium tabular-nums">{money(endDraft.cashExpenses)}</span></div>
                <div className="p-card-line flex items-center justify-between py-2 text-sm"><span className="text-[#5c6066]">Штрафы</span><span className="font-medium tabular-nums">{money(endDraft.cashFines)}</span></div>
                <div className="flex items-center justify-between py-2 text-sm font-bold"><span>Итог смены</span><span className="tabular-nums text-[#5e9128]">{money(endDraft.cashEnd)}</span></div>
              </div>

              {remarks.length > 0 && (
                <div className="p-card mt-3 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name="warning" size={16} className="text-[#8fc640]" />Замечания</div>
                  <div className="flex flex-col gap-2">
                    {remarks.map((r, i) => (
                      <div key={i} className="rounded-2xl bg-white p-2.5 text-sm ring-1 ring-inset ring-[#e7e9e2]">
                        <div className="flex items-center gap-2 font-medium">
                          {r.photos > 0 && <Icon name="camera" size={14} className="shrink-0 text-[#9a9d96]" />}
                          {r.text}
                        </div>
                        {r.comment && <p className="mt-1 text-xs text-[#5c6066]">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#e7e9e2] px-5 py-4">
              <button onClick={copySummary} className="p-btn p-btn-outline flex-1 py-3 text-xs">Скопировать</button>
              <button onClick={sendWhatsApp} className="p-btn p-btn-primary flex-1 py-3 text-xs">Отправить в WhatsApp</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
