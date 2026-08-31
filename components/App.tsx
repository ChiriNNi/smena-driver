'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './Header';
import PinModal from './PinModal';
import ShiftInfoPanel from './ShiftInfoPanel';
import Checklist from './Checklist';
import HistoryPanel from './HistoryPanel';
import Fleet from './Fleet';
import Rules from './Rules';
import Reports from './Reports';
import { apiGet, apiSend, uid } from '@/lib/client-api';
import { CHECKLIST, itemKey } from '@/lib/checklist-data';
import { emptyDraft, type Driver, type DraftData } from '@/lib/types';

type Tab = 'start' | 'process' | 'end' | 'rules' | 'fleet' | 'reports';

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: 'start', label: '🌅 Начало' },
  { id: 'process', label: '⚡ Процесс' },
  { id: 'end', label: '🌙 Завершение' },
  { id: 'rules', label: '📘 Правила' },
  { id: 'fleet', label: '🚘 Автопарк' },
  { id: 'reports', label: '📊 Отчёты', adminOnly: true },
];

const DEVICE_DRIVER_KEY = 'ovi_device_driver';

export default function App() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState('');
  const [draft, setDraft] = useState<DraftData>(() => emptyDraft(uid()));
  const [tab, setTab] = useState<Tab>('start');
  const [showHistory, setShowHistory] = useState(false);
  const [pinModal, setPinModal] = useState<null | { title: string; message: string; onSubmit: (pin: string) => Promise<string | null> }>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDrivers = useCallback(async () => {
    const d = await apiGet<{ drivers: Driver[] }>('/api/drivers');
    setDrivers(d.drivers);
  }, []);

  const refreshAuth = useCallback(async () => {
    const a = await apiGet<{ hasPin: boolean; isAdmin: boolean }>('/api/auth');
    setHasPin(a.hasPin);
    setIsAdmin(a.isAdmin);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка при монтировании приложения
    refreshAuth();
    loadDrivers();
    const saved = typeof window !== 'undefined' ? localStorage.getItem(DEVICE_DRIVER_KEY) : null;
    if (saved) setDriverId(saved);
  }, [refreshAuth, loadDrivers]);

  // Загрузка черновика при выборе водителя
  useEffect(() => {
    if (!driverId) return;
    localStorage.setItem(DEVICE_DRIVER_KEY, driverId);
    apiGet<{ data: DraftData | null }>(`/api/draft?driverId=${driverId}`).then((res) => {
      const d = drivers.find((x) => x.id === driverId);
      if (res.data) {
        setDraft({ ...res.data, shiftInfo: { ...res.data.shiftInfo, driverId, driverName: d?.name || '' } });
      } else {
        const fresh = emptyDraft(uid());
        fresh.shiftInfo.driverId = driverId;
        fresh.shiftInfo.driverName = d?.name || '';
        setDraft(fresh);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, drivers.length]);

  // Автосохранение черновика (debounce)
  useEffect(() => {
    if (!driverId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiSend('/api/draft', 'PUT', { driverId, data: draft }).catch(() => {});
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draft, driverId]);

  const allKeys = useMemo(
    () => CHECKLIST.flatMap((p) => p.sections.flatMap((s) => s.items.map((_, i) => itemKey(p.id, s.id, i)))),
    []
  );
  const progress = useMemo(() => {
    if (allKeys.length === 0) return 0;
    const done = allKeys.filter((k) => draft.checked[k]).length;
    return Math.round((done / allKeys.length) * 100);
  }, [allKeys, draft.checked]);

  function patchShiftInfo(patch: Partial<DraftData['shiftInfo']>) {
    setDraft((d) => ({ ...d, shiftInfo: { ...d.shiftInfo, ...patch } }));
  }
  function toggle(key: string) {
    setDraft((d) => ({ ...d, checked: { ...d.checked, [key]: !d.checked[key] } }));
  }
  function noteChange(key: string, text: string) {
    setDraft((d) => ({ ...d, notes: { ...d.notes, [key]: { text, photos: d.notes[key]?.photos || [] } } }));
  }
  function addPhoto(key: string, dataUrl: string) {
    setDraft((d) => ({ ...d, notes: { ...d.notes, [key]: { text: d.notes[key]?.text || '', photos: [...(d.notes[key]?.photos || []), dataUrl] } } }));
  }
  function deletePhoto(key: string, idx: number) {
    setDraft((d) => {
      const photos = [...(d.notes[key]?.photos || [])];
      photos.splice(idx, 1);
      return { ...d, notes: { ...d.notes, [key]: { text: d.notes[key]?.text || '', photos } } };
    });
  }
  function resetChecklist() {
    if (!confirm('Обнулить галочки текущего чек-листа?')) return;
    setDraft((d) => ({ ...d, checked: {}, notes: {} }));
  }

  async function finishShift() {
    if (!driverId) { alert('Сначала выберите водителя на смене.'); return; }
    if (!confirm('Завершить смену и сохранить в историю? Чек-лист и данные смены будут очищены для новой смены.')) return;

    const checklistItems = CHECKLIST.flatMap((p) =>
      p.sections.flatMap((s) => s.items.map((_, i) => {
        const key = itemKey(p.id, s.id, i);
        return { phase: p.id, section: s.id, itemKey: key, checked: !!draft.checked[key], noteText: draft.notes[key]?.text, photoUrls: draft.notes[key]?.photos };
      }))
    );
    const summaryText = buildSummaryText(draft, drivers);

    try {
      const res = await apiSend<{ syncMsgs: string[] }>('/api/shifts', 'POST', {
        clientRequestId: draft.clientRequestId,
        driverId,
        driverName: draft.shiftInfo.driverName,
        date: draft.shiftInfo.date,
        timeStart: draft.shiftInfo.timeStart,
        timeEnd: draft.shiftInfo.timeEnd,
        placeStart: draft.shiftInfo.placeStart,
        placeEnd: draft.shiftInfo.placeEnd,
        cars: draft.shiftInfo.cars,
        cashStart: draft.shiftInfo.cashStart,
        cashEnd: draft.shiftInfo.cashEnd,
        cashExpenses: draft.shiftInfo.cashExpenses,
        cashFines: draft.shiftInfo.cashFines,
        odometers: draft.shiftInfo.odo,
        checklistItems,
        summaryText,
      });
      const d = drivers.find((x) => x.id === driverId);
      const fresh = emptyDraft(uid());
      fresh.shiftInfo.driverId = driverId;
      fresh.shiftInfo.driverName = d?.name || '';
      setDraft(fresh);
      alert('Смена сохранена в историю.' + (res.syncMsgs.length ? '\nВ Автопарк добавлено: ' + res.syncMsgs.join(', ') + '.' : ''));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка при сохранении смены.');
    }
  }

  function copySummary() {
    navigator.clipboard.writeText(buildSummaryText(draft, drivers));
  }
  function sendWhatsApp() {
    window.open('https://wa.me/?text=' + encodeURIComponent(buildSummaryText(draft, drivers)), '_blank');
  }

  function onLockClick() {
    if (isAdmin) {
      apiSend('/api/auth', 'POST', { action: 'logout' }).then(() => setIsAdmin(false));
      return;
    }
    if (hasPin === false) {
      setPinModal({
        title: 'Создание PIN', message: 'Придумайте PIN-код администратора (4–8 цифр).',
        onSubmit: async (pin) => {
          try {
            await apiSend('/api/auth', 'POST', { action: 'setup', pin });
            setIsAdmin(true); setHasPin(true); setPinModal(null);
            return null;
          } catch (e) { return e instanceof Error ? e.message : 'Ошибка.'; }
        },
      });
    } else {
      setPinModal({
        title: 'Вход для администратора', message: 'Введите PIN-код.',
        onSubmit: async (pin) => {
          try {
            await apiSend('/api/auth', 'POST', { action: 'login', pin });
            setIsAdmin(true); setPinModal(null);
            return null;
          } catch (e) { return e instanceof Error ? e.message : 'Неверный PIN.'; }
        },
      });
    }
  }

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-neutral-950 pb-24">
      <Header isAdmin={isAdmin} progress={progress} onLockClick={onLockClick} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6">
        <ShiftInfoPanel drivers={drivers} info={draft.shiftInfo} onChange={(p) => { patchShiftInfo(p); if (p.driverId !== undefined) setDriverId(p.driverId); }} />

        <div className="flex gap-2 overflow-x-auto">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${tab === t.id ? 'bg-amber-500 text-neutral-950' : 'border border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(tab === 'start' || tab === 'process' || tab === 'end') && (
          <Checklist
            phaseId={tab}
            checked={draft.checked}
            notes={draft.notes}
            onToggle={toggle}
            onNoteChange={noteChange}
            onAddPhoto={addPhoto}
            onDeletePhoto={deletePhoto}
          />
        )}
        {tab === 'rules' && <Rules />}
        {tab === 'fleet' && <Fleet drivers={drivers} isAdmin={isAdmin} onDriversChanged={loadDrivers} />}
        {tab === 'reports' && isAdmin && <Reports />}

        <div className="flex flex-wrap gap-2 border-t border-neutral-800 pt-4">
          <button onClick={resetChecklist} className="btn-outline">Сбросить</button>
          <button onClick={() => setShowHistory(true)} className="btn-outline">История смен</button>
          <button onClick={copySummary} className="btn-outline">Скопировать сводку</button>
          <button onClick={sendWhatsApp} className="btn-outline">Отправить в WhatsApp</button>
          <button onClick={finishShift} className="btn-gold ml-auto px-6">✓ Завершить смену</button>
        </div>
      </main>

      {showHistory && <HistoryPanel drivers={drivers} isAdmin={isAdmin} onClose={() => setShowHistory(false)} />}
      {pinModal && (
        <PinModal title={pinModal.title} message={pinModal.message} onSubmit={pinModal.onSubmit} onClose={() => setPinModal(null)} />
      )}
    </div>
  );
}

function buildSummaryText(draft: DraftData, drivers: Driver[]): string {
  const info = draft.shiftInfo;
  const driver = drivers.find((d) => d.id === info.driverId);
  const lines = [
    `Смена: ${info.date.split('-').reverse().join('.')}`,
    `Водитель: ${driver?.name || info.driverName || '—'}`,
    `Время: ${info.timeStart || '—'}–${info.timeEnd || '—'}`,
    `Места: ${info.placeStart || '—'} → ${info.placeEnd || '—'}`,
    `Авто: ${info.cars.join(', ') || '—'}`,
    `Касса: ${info.cashStart || 0} → ${info.cashEnd || 0} (расходы ${info.cashExpenses || 0}, штрафы ${info.cashFines || 0})`,
  ];
  return lines.join('\n');
}
