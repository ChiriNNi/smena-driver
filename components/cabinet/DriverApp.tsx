'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { carLabel, formatDate, initials, money, nowHHMM, requestId, todayISO, type NoteEntry } from '@/lib/labels';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from '@/lib/local-draft';
import { cashBalance, type Driver, type Shift } from '@/lib/model';
import { buildShiftSummary, whatsAppLink } from '@/lib/report-text';
import { useSession } from './session';
import { useStore } from './store';
import BriefingFlow from './BriefingFlow';
import ChecklistPhaseView from './ChecklistPhaseView';
import HistoryTab from './HistoryTab';
import ProfileTab from './ProfileTab';
import RegulationsView from './RegulationsView';
import ShiftInfoCard from './ShiftInfoCard';
import ShiftReportModal from './ShiftReportModal';
import BottomNav from './BottomNav';
import { Icon, phaseIconName } from './icons';
import { useOnline } from './useOnline';
import { Field, SelectField } from './ui';

type Tab = 'checklist' | 'rules' | 'history' | 'profile';

// Короткие подписи фаз для узкого экрана — «Начало смены» не влезает в треть
// ширины без переноса, а слово «смены» и так понятно из контекста вкладки.
const SHORT_PHASE_LABEL: Record<string, string> = { start: 'Начало', process: 'Процесс', end: 'Завершение' };

type StartInfo = { place: string; time: string; carId: string; cashStart: string; odoStart: string };
type EndInfo = {
  place: string;
  time: string;
  cashIncome: string;
  cashIncomeNote: string;
  cashExpenses: string;
  cashExpensesNote: string;
  cashFines: string;
  odoEnd: string;
};

/** Черновик смены — ровно то, что уходит в БД и восстанавливается при возврате. */
type DraftState = {
  requestId: string;
  startConfirmed: boolean;
  start: StartInfo;
  end: EndInfo;
  checked: Record<string, boolean>;
  notes: Record<string, NoteEntry>;
  /** Когда черновик изменён — по нему выбирается свежая копия: с сервера или из телефона. */
  savedAt: number;
};

const EMPTY_START: StartInfo = { place: '', time: '', carId: '', cashStart: '', odoStart: '' };
const EMPTY_END: EndInfo = {
  place: '',
  time: '',
  cashIncome: '',
  cashIncomeNote: '',
  cashExpenses: '',
  cashExpensesNote: '',
  cashFines: '',
  odoEnd: '',
};

// Пауза перед сохранением: водитель отмечает пункты подряд, и отправлять
// каждое нажатие по мобильной связи ни к чему.
const AUTOSAVE_DELAY_MS = 1200;

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

export default function DriverApp({ driver, onLogout }: { driver: Driver; onLogout: () => void }) {
  const { checklist, cars, loading, finishShift } = useStore();
  const { briefing, settings, photoUploadEnabled } = useSession();
  const online = useOnline();

  const [tab, setTab] = useState<Tab>('checklist');
  // Инструктаж по ТБ обязателен, пока сервер не подтвердит допуск. Значение
  // считаем от briefing, а не держим отдельным флагом: briefing обновляется
  // только по нашему запросу (после нажатия «Приступить к смене»), поэтому
  // экран с разбором ответов не исчезает сам собой.
  const [retakeRequested, setRetakeRequested] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [endConfirmed, setEndConfirmed] = useState(false);
  const [finishedShift, setFinishedShift] = useState<Shift | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState('');

  const [draft, setDraft] = useState<DraftState>(() => ({
    requestId: requestId(),
    startConfirmed: false,
    start: EMPTY_START,
    end: EMPTY_END,
    checked: {},
    notes: {},
    savedAt: 0,
  }));

  // Черновик восстановлен (или выяснилось, что его нет) — только после этого
  // можно сохранять, иначе пустое начальное состояние затрёт сохранённое.
  const [restored, setRestored] = useState(false);
  const pagerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  /* ─── Восстановление черновика ─────────────────────────────────────────── */

  useEffect(() => {
    (async () => {
      // Копия в телефоне читается первой и без сети: если последние отметки
      // делались в паркинге, на сервере их ещё нет.
      const local = readLocalDraft<DraftState>(driver.id);

      let remote: DraftState | null = null;
      try {
        remote = (await api.draft.get<DraftState>()).draft;
      } catch {
        // Черновик не загрузился — работаем по локальной копии, а если и её
        // нет, начинаем с чистой смены. Сохранение пойдёт с первой отметки.
      }

      const saved =
        local && remote ? ((local.savedAt ?? 0) >= (remote.savedAt ?? 0) ? local : remote) : (local ?? remote);

      // Время и авто по умолчанию подставляем здесь же: у восстановленного
      // черновика свои значения, и перетирать их нельзя. Одно обновление
      // состояния вместо двух — и никакого лишнего перерисовывания.
      const time = nowHHMM();
      setDraft((current) => {
        const merged = saved
          ? { ...current, ...saved, start: { ...current.start, ...saved.start }, end: { ...current.end, ...saved.end } }
          : current;
        return {
          ...merged,
          start: { ...merged.start, time: merged.start.time || time, carId: merged.start.carId || driver.carId },
          end: { ...merged.end, time: merged.end.time || time },
        };
      });
      setRestored(true);
    })();
  }, [driver.carId, driver.id]);

  /* ─── Автосохранение ───────────────────────────────────────────────────── */

  const hasProgress =
    draft.startConfirmed || Object.keys(draft.checked).length > 0 || Object.keys(draft.notes).length > 0;

  useEffect(() => {
    if (!restored || !hasProgress || finishedShift) return;

    // Отметка времени ставится на сохраняемую копию: по ней при следующем
    // запуске выбирается более свежая из двух — серверной и локальной.
    const snapshot: DraftState = { ...draft, savedAt: Date.now() };

    // В телефон пишем сразу, без задержки: локальная копия нужна именно в тот
    // момент, когда отправка не удастся.
    writeLocalDraft(driver.id, snapshot);

    // online в зависимостях — это и есть повтор отправки: как только сеть
    // вернулась, эффект перезапускается и черновик уходит на сервер сам.
    const timer = setTimeout(async () => {
      setSaveState('saving');
      try {
        await api.draft.save(snapshot);
        setSaveState('saved');
        setSavedAt(nowHHMM());
      } catch {
        // Без сети это не ошибка: данные целы в телефоне и уйдут позже.
        setSaveState(navigator.onLine ? 'error' : 'offline');
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft, restored, hasProgress, finishedShift, driver.id, online]);

  /* ─── Перенос показаний с прошлой смены ────────────────────────────────── */

  // Остаток кассы и одометр не вводятся заново: начало смены — это конец
  // предыдущей. Подставляются только в пустые поля, чтобы не затирать то, что
  // водитель уже поправил сам.
  const [opening, setOpening] = useState<api.ShiftOpening | null>(null);

  useEffect(() => {
    if (!restored || draft.startConfirmed) return;
    let alive = true;

    api.shifts
      .opening(draft.start.carId || undefined)
      .then((res) => {
        if (!alive) return;
        setOpening(res);
        setDraft((d) => {
          const cashStart = d.start.cashStart === '' && res.cash !== null ? String(res.cash) : d.start.cashStart;
          const odoStart = d.start.odoStart === '' && res.odo !== null ? String(res.odo) : d.start.odoStart;
          if (cashStart === d.start.cashStart && odoStart === d.start.odoStart) return d;
          return { ...d, start: { ...d.start, cashStart, odoStart } };
        });
      })
      .catch(() => {
        // Не узнали перенос — водитель введёт показания сам, как раньше.
      });

    return () => {
      alive = false;
    };
  }, [restored, draft.startConfirmed, draft.start.carId]);

  /* ─── Инструктаж по ТБ ─────────────────────────────────────────────────── */

  const briefingValid = briefing?.valid ?? true;
  const briefingOpen = retakeRequested || !briefingValid;

  /* ─── Производные значения ─────────────────────────────────────────────── */

  const allItems = useMemo(
    () =>
      checklist.flatMap((phase) =>
        phase.sections.flatMap((section) =>
          section.items.map((item) => ({ ...item, phaseId: phase.id, sectionTitle: section.title }))
        )
      ),
    [checklist]
  );

  const totalItems = allItems.length;
  const doneItems = allItems.filter((item) => draft.checked[item.id]).length;
  const progress = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  const remarks = useMemo(
    () =>
      allItems
        .map((item) => ({ item, note: draft.notes[item.id] }))
        .filter(({ note }) => note && (note.comment.trim() !== '' || note.photos.length > 0))
        .map(({ item, note }) => ({ text: item.text, comment: note!.comment.trim(), photos: note!.photos.length })),
    [allItems, draft.notes]
  );

  const setStart = useCallback((patch: Partial<StartInfo>) => {
    setDraft((d) => ({ ...d, start: { ...d.start, ...patch } }));
  }, []);

  const setEnd = useCallback((patch: Partial<EndInfo>) => {
    setDraft((d) => ({ ...d, end: { ...d.end, ...patch } }));
  }, []);

  function toggle(itemId: string) {
    setDraft((d) => ({ ...d, checked: { ...d.checked, [itemId]: !d.checked[itemId] } }));
  }

  function setNote(itemId: string, entry: NoteEntry) {
    setDraft((d) => ({ ...d, notes: { ...d.notes, [itemId]: entry } }));
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

  // Возврат на вкладку «Чек-лист» перемонтирует пейджер со scrollLeft = 0,
  // из-за чего фаза сбрасывалась на первую. Восстанавливаем позицию сами.
  useEffect(() => {
    if (tab !== 'checklist' || !draft.startConfirmed) return;
    const el = pagerRef.current;
    if (el) el.scrollLeft = phaseIdx * el.clientWidth;
  }, [tab, draft.startConfirmed, phaseIdx]);

  /* ─── Сводка и WhatsApp ────────────────────────────────────────────────── */

  /* ─── Касса ────────────────────────────────────────────────────────────── */

  // Остаток не вводится, а считается — той же формулой, что и на сервере.
  // Раньше это было отдельное поле, и в истории остались смены, где остаток
  // не выводился из начала и расхода вовсе.
  const cashFacts = useMemo(
    () => ({
      cashStart: Number(draft.start.cashStart) || 0,
      cashIncome: Number(draft.end.cashIncome) || 0,
      cashExpenses: Number(draft.end.cashExpenses) || 0,
      cashFines: Number(draft.end.cashFines) || 0,
    }),
    [draft.start.cashStart, draft.end.cashIncome, draft.end.cashExpenses, draft.end.cashFines]
  );
  const cashEnd = cashBalance(cashFacts);

  const summaryText = buildShiftSummary({
    driverLabel: `${driver.lastName} ${driver.firstName}`,
    carLabel: carLabel(cars, draft.start.carId || driver.carId),
    date: todayISO(),
    timeStart: draft.start.time,
    timeEnd: draft.end.time,
    placeStart: draft.start.place,
    placeEnd: draft.end.place,
    done: doneItems,
    total: totalItems,
    ...cashFacts,
    cashIncomeNote: draft.end.cashIncomeNote,
    cashExpensesNote: draft.end.cashExpensesNote,
    cashEnd,
    odoStart: Number(draft.start.odoStart) || 0,
    odoEnd: Number(draft.end.odoEnd) || 0,
    remarks,
  });

  function sendWhatsApp() {
    window.open(whatsAppLink(summaryText, settings?.whatsappTarget ?? ''), '_blank');
  }

  /* ─── Завершение смены ─────────────────────────────────────────────────── */

  async function submitShift() {
    setFinishing(true);
    setEndConfirmed(true);

    const shift = await finishShift({
      // Один и тот же ключ на все попытки отправки этой смены: повторное
      // нажатие или ретрай на плохой связи не создадут вторую запись.
      clientRequestId: draft.requestId,
      carId: draft.start.carId,
      date: todayISO(),
      timeStart: draft.start.time,
      timeEnd: draft.end.time,
      placeStart: draft.start.place,
      placeEnd: draft.end.place,
      // Остаток сервер считает сам — отправляем то, из чего он получается.
      ...cashFacts,
      cashIncomeNote: draft.end.cashIncomeNote,
      cashExpensesNote: draft.end.cashExpensesNote,
      odoStart: Number(draft.start.odoStart) || 0,
      odoEnd: Number(draft.end.odoEnd) || 0,
      // Снимок чек-листа целиком, включая неотмеченное: в отчёте должно быть
      // видно не только сделанное, но и пропущенное.
      items: allItems.map((item) => {
        const note = draft.notes[item.id];
        return {
          phase: item.phaseId,
          sectionTitle: item.sectionTitle,
          text: item.text,
          checked: !!draft.checked[item.id],
          comment: note?.comment.trim() ?? '',
          photoPaths: note?.photos.map((p) => p.path) ?? [],
        };
      }),
    });

    setFinishing(false);
    if (shift) setFinishedShift(shift);
    // Не отправилось (ошибка показана плашкой) — возвращаем форму, чтобы
    // водитель мог поправить данные и попробовать снова.
    else setEndConfirmed(false);
  }

  /** После закрытия отчёта смена сдана — кабинет готов к следующей. */
  function resetShift() {
    setFinishedShift(null);
    setOpenNoteKey(null);
    setEndConfirmed(false);
    setPhaseIdx(0);
    setSaveState('idle');
    const time = nowHHMM();
    clearLocalDraft(driver.id);
    setDraft({
      requestId: requestId(),
      startConfirmed: false,
      start: { ...EMPTY_START, time, carId: driver.carId },
      end: { ...EMPTY_END, time },
      checked: {},
      notes: {},
      savedAt: 0,
    });
    setTab('history');
  }

  /* ─── Разметка ─────────────────────────────────────────────────────────── */

  const startDisabled = !draft.start.place.trim() || !draft.start.time || !draft.start.carId;
  const endDisabled = !draft.end.place.trim() || !draft.end.time || finishing || cashEnd < 0;
  const activeCars = cars.filter((c) => c.active || c.id === draft.start.carId);

  const startFields = (
    <>
      <Field
        label="Место начала смены"
        value={draft.start.place}
        onChange={(e) => setStart({ place: e.target.value })}
        placeholder="Офис, Алматы"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Время" type="time" value={draft.start.time} onChange={(e) => setStart({ time: e.target.value })} />
        <Field
          label="Касса на начало, ₸"
          inputMode="numeric"
          value={draft.start.cashStart}
          onChange={(e) => setStart({ cashStart: e.target.value.replace(/\D/g, '') })}
          placeholder="0"
          hint={carryoverHint(opening?.cash ?? null, opening?.cashDate ?? null)}
        />
      </div>
      <SelectField label="Автомобиль" value={draft.start.carId} onChange={(e) => setStart({ carId: e.target.value })}>
        <option value="">Выберите автомобиль</option>
        {activeCars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.model} — {c.plate}
          </option>
        ))}
      </SelectField>
      <Field
        label="Одометр, км"
        inputMode="numeric"
        value={draft.start.odoStart}
        onChange={(e) => setStart({ odoStart: e.target.value.replace(/\D/g, '') })}
        placeholder="84210"
        hint={
          carryoverHint(opening?.odo ?? null, opening?.odoDate ?? null, 'км') ??
          'Показание на начало смены — по нему считается пробег.'
        }
      />
    </>
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e7e9e2] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-sm font-bold text-[#5e9128]">
            {initials(driver)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {driver.lastName} {driver.firstName}
            </div>
            <div className="truncate text-xs text-[#9a9d96]">
              {carLabel(cars, draft.startConfirmed ? draft.start.carId : driver.carId)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2 text-xs text-[#5c6066]">
            <div className="h-2 w-16 overflow-hidden rounded-full bg-[#f0f1ec]">
              <div className="h-full rounded-full bg-[#8fc640] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-semibold tabular-nums text-[#1a1d1e]">{progress}%</span>
          </div>
          {hasProgress && !finishedShift && <SaveIndicator state={saveState} at={savedAt} />}
        </div>
      </header>

      {/* Полоса «нет сети»: водитель должен понимать, что смена не потерялась,
          а ждёт связи — иначе он начинает проходить чек-лист заново. */}
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-[#b5811c]/12 px-4 py-2 text-center text-[11px] font-semibold text-[#96690f]">
          <Icon name="warning" size={13} className="shrink-0" />
          Нет сети — отметки сохраняются в телефоне и уйдут сами
        </div>
      )}

      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto pb-24">
        {tab === 'checklist' && loading && (
          <div className="px-4 py-10 text-center text-sm text-[#9a9d96]">Загружаем чек-лист…</div>
        )}

        {tab === 'checklist' && !loading && briefingOpen && (
          <BriefingFlow
            // Допуск к этому моменту уже обновлён ответом сервера на подпись,
            // поэтому здесь только закрываем инструктаж.
            onDone={() => setRetakeRequested(false)}
            onExit={briefingValid ? () => setRetakeRequested(false) : undefined}
          />
        )}

        {tab === 'checklist' && !loading && !briefingOpen && !draft.startConfirmed && (
          <div className="px-5 py-8">
            <div className="p-fade-up mx-auto mb-6 max-w-xs text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
                <Icon name="map" size={22} />
              </div>
              <h2 className="text-lg font-bold">Начало смены</h2>
              <p className="mt-1.5 text-sm text-[#5c6066]">
                Зафиксируйте место, время и кассу — после этого откроется чек-лист
              </p>
            </div>
            <ShiftInfoCard
              icon="map"
              title="Данные начала смены"
              confirmed={false}
              summary=""
              confirmLabel="Начать смену"
              confirmDisabled={startDisabled}
              onConfirm={() => setDraft((d) => ({ ...d, startConfirmed: true }))}
              onEdit={() => {}}
            >
              {startFields}
            </ShiftInfoCard>

            {cars.length === 0 && (
              <p className="mt-4 text-center text-xs leading-relaxed text-[#c0564a]">
                В автопарке нет ни одного автомобиля — попросите администратора добавить машину.
              </p>
            )}
          </div>
        )}

        {tab === 'checklist' && !loading && !briefingOpen && draft.startConfirmed && (
          <>
            <div className="grid grid-cols-3 gap-2 border-b border-[#e7e9e2] bg-[#f5f6f1] px-3 py-3">
              {checklist.map((ph, i) => (
                <button
                  key={ph.id}
                  onClick={() => goToPhase(i)}
                  className={
                    'p-btn flex min-h-11 items-center justify-center gap-1 whitespace-nowrap px-2 py-2 text-[11px] ' +
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
                summary={`${draft.start.time}, ${draft.start.place || 'место не указано'} · ${carLabel(cars, draft.start.carId)}`}
                confirmLabel="Начать смену"
                confirmDisabled={startDisabled}
                onConfirm={() => setDraft((d) => ({ ...d, startConfirmed: true }))}
                onEdit={() => setDraft((d) => ({ ...d, startConfirmed: false }))}
              >
                {startFields}
              </ShiftInfoCard>
            </div>

            <div ref={pagerRef} onScroll={onScrollPager} className="pager flex overflow-x-auto">
              {checklist.map((ph, i) => (
                <ChecklistPhaseView
                  key={ph.id}
                  phase={ph}
                  checked={draft.checked}
                  onToggle={toggle}
                  notes={draft.notes}
                  openNoteKey={openNoteKey}
                  onOpenNote={setOpenNoteKey}
                  onNoteChange={setNote}
                  photoUploadEnabled={photoUploadEnabled}
                  footerExtra={
                    ph.id === 'end' ? (
                      <ShiftInfoCard
                        icon="wallet"
                        title="Данные завершения смены"
                        confirmed={endConfirmed}
                        summary={`${draft.end.time}, ${draft.end.place || 'место не указано'}`}
                        confirmLabel={finishing ? 'Отправляем…' : 'Завершить смену'}
                        confirmDisabled={endDisabled}
                        onConfirm={submitShift}
                        onEdit={() => setEndConfirmed(false)}
                      >
                        <Field
                          label="Место завершения смены"
                          value={draft.end.place}
                          onChange={(e) => setEnd({ place: e.target.value })}
                          placeholder="Офис, Алматы"
                        />
                        <Field label="Время" type="time" value={draft.end.time} onChange={(e) => setEnd({ time: e.target.value })} />

                        {/* Касса: приход и расход одной суммой каждый, рядом —
                            от кого и на что, как это писали в журнале. */}
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            label="Приход, ₸"
                            inputMode="numeric"
                            value={draft.end.cashIncome}
                            onChange={(e) => setEnd({ cashIncome: e.target.value.replace(/\D/g, '') })}
                            placeholder="0"
                          />
                          <Field
                            label="От кого"
                            value={draft.end.cashIncomeNote}
                            onChange={(e) => setEnd({ cashIncomeNote: e.target.value })}
                            placeholder="от ЛВ"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            label="Расход, ₸"
                            inputMode="numeric"
                            value={draft.end.cashExpenses}
                            onChange={(e) => setEnd({ cashExpenses: e.target.value.replace(/\D/g, '') })}
                            placeholder="0"
                          />
                          <Field
                            label="На что"
                            value={draft.end.cashExpensesNote}
                            onChange={(e) => setEnd({ cashExpensesNote: e.target.value })}
                            placeholder="обед, магазин"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            label="Штрафы, ₸"
                            inputMode="numeric"
                            value={draft.end.cashFines}
                            onChange={(e) => setEnd({ cashFines: e.target.value.replace(/\D/g, '') })}
                            placeholder="0"
                          />
                          <Field
                            label="Одометр, км"
                            inputMode="numeric"
                            value={draft.end.odoEnd}
                            onChange={(e) => setEnd({ odoEnd: e.target.value.replace(/\D/g, '') })}
                            placeholder="84515"
                          />
                        </div>

                        <CashBalance facts={cashFacts} total={cashEnd} />
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

        {tab === 'rules' && <RegulationsView />}
        {tab === 'history' && <HistoryTab driver={driver} />}
        {tab === 'profile' && (
          <ProfileTab
            driver={driver}
            onLogout={onLogout}
            onSendWhatsApp={sendWhatsApp}
            onRetakeBriefing={() => {
              setRetakeRequested(true);
              setTab('checklist');
            }}
            onOpenRules={() => setTab('rules')}
          />
        )}
      </main>

      <BottomNav
        items={[
          { id: 'checklist', icon: 'clipboard', label: 'Чек-лист' },
          { id: 'rules', icon: 'shield', label: 'Правила' },
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

/** Состояние автосохранения — на плохой связи должно быть видно, что данные целы. */
function SaveIndicator({ state, at }: { state: SaveState; at: string }) {
  if (state === 'idle') return null;

  const text =
    state === 'saving'
      ? 'сохраняем…'
      : state === 'saved'
        ? `сохранено ${at}`
        : state === 'offline'
          ? 'нет сети — сохранено в телефоне'
          : 'не сохранено — проверьте связь';

  return (
    <span
      className={
        'text-right text-[10px] ' +
        (state === 'error' ? 'font-semibold text-[#c0564a]' : state === 'offline' ? 'text-[#96690f]' : 'text-[#9a9d96]')
      }
    >
      {text}
    </span>
  );
}

/**
 * Подсказка о переносе с прошлой смены. Показывается только когда перенос
 * действительно был: иначе водитель решит, что число взято непонятно откуда.
 */
function carryoverHint(value: number | null, date: string | null, unit = '₸'): string | undefined {
  if (value === null) return undefined;
  const when = date ? ` за ${formatDate(date)}` : '';
  return `Перенос с прошлой смены${when}: ${value.toLocaleString('ru-RU')} ${unit}`;
}

/**
 * Остаток кассы: сумма, которую водитель никуда не вводит.
 *
 * Показывается строками, из которых он получился, — так видно, откуда взялось
 * число, и водитель замечает опечатку до отправки смены, а не в конце месяца
 * при сведении отчёта.
 */
function CashBalance({
  facts,
  total,
}: {
  facts: { cashStart: number; cashIncome: number; cashExpenses: number; cashFines: number };
  total: number;
}) {
  const income = facts.cashStart + facts.cashIncome;
  const outflow = facts.cashExpenses + facts.cashFines;

  return (
    <div className="rounded-2xl bg-[#f5f6f1] p-3.5">
      <div className="flex flex-col gap-1 text-xs text-[#5c6066]">
        <Line label="Начало смены" value={facts.cashStart} />
        <Line label="Приход" value={facts.cashIncome} />
        <Line label="Итого доход" value={income} strong />
        <Line label="Расход" value={-facts.cashExpenses} />
        {facts.cashFines > 0 && <Line label="Штрафы" value={-facts.cashFines} />}
        {outflow > 0 && <Line label="Итого расход" value={-outflow} strong />}
      </div>

      <div
        className={
          'mt-2.5 flex items-center justify-between gap-3 border-t border-[#e7e9e2] pt-2.5 text-sm font-bold ' +
          (total < 0 ? 'text-[#c0564a]' : 'text-[#1a1d1e]')
        }
      >
        <span>Остаток в кассе</span>
        <span className="tabular-nums">{money(total)}</span>
      </div>

      {total < 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed font-semibold text-[#c0564a]">
          Расход больше, чем было в кассе с приходом. Проверьте суммы — смену с таким остатком закрыть нельзя.
        </p>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-[#9a9d96]">
          Считается сам: начало + приход − расход − штрафы. Этот остаток станет началом следующей смены.
        </p>
      )}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={'flex items-center justify-between gap-3 ' + (strong ? 'font-semibold text-[#1a1d1e]' : '')}>
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}
