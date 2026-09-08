'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { itemKey, type ChecklistPhase } from '@/lib/checklist-data';
import {
  buildWhatsAppSummary,
  carLabel,
  countChecklistItems,
  initials,
  isBriefingValid,
  nowHHMM,
  todayISO,
  uid,
  type NoteEntry,
  type ProtoDriver,
  type ProtoShift,
  type ShiftRemark,
} from '@/lib/proto-data';
import { useStore } from './store';
import BriefingFlow from './BriefingFlow';
import ChecklistPhaseView from './ChecklistPhaseView';
import HistoryTab from './HistoryTab';
import ProfileTab from './ProfileTab';
import ShiftInfoCard from './ShiftInfoCard';
import ShiftReportModal from './ShiftReportModal';
import BottomNav from './BottomNav';
import { Icon, phaseIconName } from './icons';
import { Field, SelectField } from './ui';

type Tab = 'checklist' | 'history' | 'profile';

// Короткие подписи фаз для узкого экрана — «Начало смены» не влезает в треть
// ширины без переноса, а слово «смены» и так понятно из контекста вкладки.
const SHORT_PHASE_LABEL: Record<string, string> = { start: 'Начало', process: 'Процесс', end: 'Завершение' };

export default function DriverApp({ driver, onLogout }: { driver: ProtoDriver; onLogout: () => void }) {
  const { checklist, cars, acks, addShift } = useStore();

  const [tab, setTab] = useState<Tab>('checklist');
  // Инструктаж по ТБ: обязателен, если тест не сдан или просрочен. Держим в
  // состоянии, а не в производном значении — иначе экран с результатом теста
  // исчезал сам, как только допуск открывался, и водитель не видел разбора.
  const [briefingOpen, setBriefingOpen] = useState(() => !isBriefingValid(acks, driver.id));
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, NoteEntry>>({});
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [finishedShift, setFinishedShift] = useState<ProtoShift | null>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Данные начала/завершения смены — как в старой панели «Данные смены»,
  // только по одной карточке в соответствующей фазе вместо одной большой формы.
  const [startDraft, setStartDraft] = useState({ place: '', time: '', carId: driver.carId, cashStart: '', odoStart: '' });
  const [startConfirmed, setStartConfirmed] = useState(false);
  const [endDraft, setEndDraft] = useState({ place: '', time: '', cashEnd: '', cashExpenses: '', cashFines: '', odoEnd: '' });
  const [endConfirmed, setEndConfirmed] = useState(false);

  // Время по умолчанию проставляем только на клиенте после монтирования —
  // иначе строка "HH:MM" в SSR-рендере разъедется с клиентской гидратацией.
  useEffect(() => {
    const t = nowHHMM();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- одноразовая подстановка текущего времени после монтирования, чтобы не разъехаться с SSR
    setStartDraft((d) => (d.time ? d : { ...d, time: t }));
    setEndDraft((d) => (d.time ? d : { ...d, time: t }));
  }, []);

  // Возврат на вкладку «Чек-лист» перемонтирует пейджер со scrollLeft = 0,
  // из-за чего фаза сбрасывалась на первую. Восстанавливаем позицию сами.
  useEffect(() => {
    if (tab !== 'checklist' || !startConfirmed) return;
    const el = pagerRef.current;
    if (el) el.scrollLeft = phaseIdx * el.clientWidth;
  }, [tab, startConfirmed, phaseIdx]);

  const totalItems = useMemo(() => countChecklistItems(checklist), [checklist]);
  const doneItems = Object.values(checked).filter(Boolean).length;
  const progress = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  // Замечания к пунктам чек-листа — попадают в итоговый отчёт по смене.
  const remarks = useMemo<ShiftRemark[]>(() => {
    const list: ShiftRemark[] = [];
    checklist.forEach((ph) => {
      ph.sections.forEach((section) => {
        section.items.forEach((item, idx) => {
          const note = notes[itemKey(ph.id, section.id, idx)];
          if (note && (note.comment.trim() || note.photos.length > 0)) {
            list.push({ text: item.text, comment: note.comment.trim(), photos: note.photos.length });
          }
        });
      });
    });
    return list;
  }, [checklist, notes]);

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
    driver,
    cars,
    doneItems,
    totalItems,
    shiftDate,
    startConfirmed ? startDraft : undefined,
    endConfirmed ? endDraft : undefined
  );

  function sendWhatsApp() {
    window.open('https://wa.me/?text=' + encodeURIComponent(summaryText), '_blank');
  }

  /** Завершение смены: пишем её в общий список (админ сразу видит) и открываем отчёт. */
  function finishShift() {
    const shift: ProtoShift = {
      id: uid('s'),
      driverId: driver.id,
      carId: startDraft.carId,
      date: todayISO(),
      timeStart: startDraft.time,
      timeEnd: endDraft.time,
      placeStart: startDraft.place,
      placeEnd: endDraft.place,
      done: doneItems,
      total: totalItems,
      cashStart: Number(startDraft.cashStart) || 0,
      cashEnd: Number(endDraft.cashEnd) || 0,
      cashExpenses: Number(endDraft.cashExpenses) || 0,
      cashFines: Number(endDraft.cashFines) || 0,
      odoStart: Number(startDraft.odoStart) || 0,
      odoEnd: Number(endDraft.odoEnd) || 0,
      remarks,
    };
    setEndConfirmed(true);
    addShift(shift);
    setFinishedShift(shift);
  }

  /** После закрытия отчёта смена считается сданной — кабинет готов к новой. */
  function resetShift() {
    setFinishedShift(null);
    setChecked({});
    setNotes({});
    setOpenNoteKey(null);
    setStartConfirmed(false);
    setEndConfirmed(false);
    setPhaseIdx(0);
    const t = nowHHMM();
    setStartDraft({ place: '', time: t, carId: driver.carId, cashStart: '', odoStart: '' });
    setEndDraft({ place: '', time: t, cashEnd: '', cashExpenses: '', cashFines: '', odoEnd: '' });
    setTab('history');
  }

  const briefingValid = isBriefingValid(acks, driver.id);
  const startDisabled = !startDraft.place.trim() || !startDraft.time || !startDraft.carId;
  const endDisabled = !endDraft.place.trim() || !endDraft.time;
  const activeCars = cars.filter((c) => c.active || c.id === startDraft.carId);

  const startFields = (
    <>
      <Field
        label="Место начала смены"
        value={startDraft.place}
        onChange={(e) => setStartDraft((d) => ({ ...d, place: e.target.value }))}
        placeholder="Офис, Алматы"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Время" type="time" value={startDraft.time} onChange={(e) => setStartDraft((d) => ({ ...d, time: e.target.value }))} />
        <Field
          label="Касса, ₸"
          inputMode="numeric"
          value={startDraft.cashStart}
          onChange={(e) => setStartDraft((d) => ({ ...d, cashStart: e.target.value.replace(/\D/g, '') }))}
          placeholder="0"
        />
      </div>
      <SelectField label="Автомобиль" value={startDraft.carId} onChange={(e) => setStartDraft((d) => ({ ...d, carId: e.target.value }))}>
        {activeCars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.model} — {c.plate}
          </option>
        ))}
      </SelectField>
      <Field
        label="Одометр, км"
        inputMode="numeric"
        value={startDraft.odoStart}
        onChange={(e) => setStartDraft((d) => ({ ...d, odoStart: e.target.value.replace(/\D/g, '') }))}
        placeholder="84210"
        hint="Показание на начало смены — по нему считается пробег."
      />
    </>
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e7e9e2] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-sm font-bold text-[#5e9128]">
            {initials(driver)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {driver.lastName} {driver.firstName}
            </div>
            <div className="truncate text-xs text-[#9a9d96]">{carLabel(cars, startConfirmed ? startDraft.carId : driver.carId)}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-[#5c6066]">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-[#f0f1ec]">
            <div className="h-full rounded-full bg-[#8fc640] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="font-semibold tabular-nums text-[#1a1d1e]">{progress}%</span>
        </div>
      </header>

      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto pb-24">
        {tab === 'checklist' && briefingOpen && (
          <BriefingFlow
            driver={driver}
            onDone={() => setBriefingOpen(false)}
            onExit={briefingValid ? () => setBriefingOpen(false) : undefined}
          />
        )}

        {tab === 'checklist' && !briefingOpen && !startConfirmed && (
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

        {tab === 'checklist' && !briefingOpen && startConfirmed && (
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
                confirmed
                summary={`${startDraft.time}, ${startDraft.place || 'место не указано'} · ${carLabel(cars, startDraft.carId)}`}
                confirmLabel="Начать смену"
                confirmDisabled={startDisabled}
                onConfirm={() => setStartConfirmed(true)}
                onEdit={() => setStartConfirmed(false)}
              >
                {startFields}
              </ShiftInfoCard>
            </div>

            <div ref={pagerRef} onScroll={onScrollPager} className="pager flex overflow-x-auto">
              {checklist.map((ph: ChecklistPhase, i) => (
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
                        confirmDisabled={endDisabled}
                        onConfirm={finishShift}
                        onEdit={() => setEndConfirmed(false)}
                      >
                        <Field
                          label="Место завершения смены"
                          value={endDraft.place}
                          onChange={(e) => setEndDraft((d) => ({ ...d, place: e.target.value }))}
                          placeholder="Офис, Алматы"
                        />
                        <Field label="Время" type="time" value={endDraft.time} onChange={(e) => setEndDraft((d) => ({ ...d, time: e.target.value }))} />
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
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            label="Штрафы, ₸"
                            inputMode="numeric"
                            value={endDraft.cashFines}
                            onChange={(e) => setEndDraft((d) => ({ ...d, cashFines: e.target.value.replace(/\D/g, '') }))}
                            placeholder="0"
                          />
                          <Field
                            label="Одометр, км"
                            inputMode="numeric"
                            value={endDraft.odoEnd}
                            onChange={(e) => setEndDraft((d) => ({ ...d, odoEnd: e.target.value.replace(/\D/g, '') }))}
                            placeholder="84515"
                          />
                        </div>
                      </ShiftInfoCard>
                    ) : (
                      <button
                        onClick={() => goToPhase(i + 1)}
                        className="p-btn p-btn-primary flex items-center justify-center gap-1.5 py-3.5"
                      >
                        Далее
                        <Icon name="chevron-up" size={15} className="rotate-90" />
                      </button>
                    )
                  }
                />
              ))}
            </div>
          </>
        )}

        {tab === 'history' && <HistoryTab driver={driver} />}
        {tab === 'profile' && (
          <ProfileTab
            driver={driver}
            onLogout={onLogout}
            onSendWhatsApp={sendWhatsApp}
            onRetakeBriefing={() => {
              setBriefingOpen(true);
              setTab('checklist');
            }}
          />
        )}
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

      {finishedShift && <ShiftReportModal shift={finishedShift} title="Смена завершена" onClose={resetShift} />}
    </div>
  );
}
