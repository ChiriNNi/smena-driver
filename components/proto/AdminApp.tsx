'use client';

import { useState } from 'react';
import { initials, type ProtoDriver } from '@/lib/proto-data';
import AdminShifts from './AdminShifts';
import AdminDrivers from './AdminDrivers';
import AdminFleet from './AdminFleet';
import AdminSettings from './AdminSettings';
import BottomNav from './BottomNav';

type Tab = 'shifts' | 'drivers' | 'fleet' | 'settings';

export default function AdminApp({ admin, onLogout }: { admin: ProtoDriver; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('shifts');

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

      <main className="min-h-0 flex-1 overflow-y-auto pb-24">
        {tab === 'shifts' && <AdminShifts />}
        {tab === 'drivers' && <AdminDrivers />}
        {tab === 'fleet' && <AdminFleet />}
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
        onChange={setTab}
      />
    </div>
  );
}
