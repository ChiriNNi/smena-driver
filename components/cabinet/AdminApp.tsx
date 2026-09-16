'use client';

import { useMemo, useState } from 'react';
import { daysUntil, formatDate, initials } from '@/lib/labels';
import type { Driver } from '@/lib/model';
import { useStore } from './store';
import { Icon } from './icons';
import AdminShifts from './AdminShifts';
import AdminDrivers from './AdminDrivers';
import AdminFleet, { type FleetTab } from './AdminFleet';
import AdminSettings from './AdminSettings';
import BottomNav from './BottomNav';

type Tab = 'shifts' | 'drivers' | 'fleet' | 'settings';

/** За сколько дней до срока напоминание начинает попадаться на глаза. */
const WARN_DAYS = 14;

export default function AdminApp({ admin, onLogout }: { admin: Driver; onLogout: () => void }) {
  const { reminders } = useStore();
  const [tab, setTab] = useState<Tab>('shifts');
  const [fleetTab, setFleetTab] = useState<FleetTab>('cars');

  // Сроки ТО и страховки раньше подсвечивались только на своём экране — то
  // есть их видел лишь тот, кто и так туда зашёл. Теперь ближайший срок
  // попадается на глаза сразу после входа.
  const due = useMemo(() => {
    const soon = reminders
      .map((r) => ({ ...r, days: daysUntil(r.dueDate) }))
      .filter((r) => r.days <= WARN_DAYS)
      .sort((a, b) => a.days - b.days);
    return { count: soon.length, first: soon[0] ?? null, overdue: soon.filter((r) => r.days < 0).length };
  }, [reminders]);

  function openReminders() {
    setFleetTab('reminders');
    setTab('fleet');
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e7e9e2] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-sm font-bold text-[#5e9128]">
            {initials(admin)}
          </div>
          <div>
            <div className="text-sm font-semibold">
              {admin.lastName} {admin.firstName}
            </div>
            <div className="text-xs font-semibold text-[#8fc640]">Администратор</div>
          </div>
        </div>
        <button onClick={onLogout} className="p-btn p-btn-outline px-4 py-1.5 text-xs">
          Выйти
        </button>
      </header>

      {due.first && (
        <button
          onClick={openReminders}
          className={
            'flex items-center gap-2 px-4 py-2 text-left text-[11px] font-semibold ' +
            (due.overdue > 0 ? 'bg-[#c0564a]/12 text-[#a0432a]' : 'bg-[#b5811c]/12 text-[#96690f]')
          }
        >
          <Icon name="warning" size={13} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {due.first.kind}
            {due.first.days < 0
              ? ` просрочено на ${Math.abs(due.first.days)} дн.`
              : due.first.days === 0
                ? ' сегодня'
                : ` через ${due.first.days} дн.`}
            {` · ${formatDate(due.first.dueDate)}`}
            {due.count > 1 && ` и ещё ${due.count - 1}`}
          </span>
          <Icon name="arrow-right" size={13} className="shrink-0" />
        </button>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto pb-24">
        {tab === 'shifts' && <AdminShifts />}
        {tab === 'drivers' && <AdminDrivers />}
        {tab === 'fleet' && <AdminFleet initialTab={fleetTab} />}
        {tab === 'settings' && <AdminSettings />}
      </main>

      <BottomNav
        items={[
          { id: 'shifts', icon: 'chart', label: 'Смены' },
          { id: 'drivers', icon: 'id-card', label: 'Водители' },
          { id: 'fleet', icon: 'car', label: 'Автопарк' },
          { id: 'settings', icon: 'settings', label: 'Настройки' },
        ]}
        active={tab}
        // Заход в «Автопарк» через нижнее меню всегда открывает автомобили:
        // на напоминания попадают только по полосе о сроке.
        onChange={(next) => {
          if (next === 'fleet') setFleetTab('cars');
          setTab(next);
        }}
      />
    </div>
  );
}
