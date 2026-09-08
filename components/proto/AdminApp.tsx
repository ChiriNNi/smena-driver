'use client';

import { useState } from 'react';
import type { ChecklistPhase } from '@/lib/checklist-data';
import type { ProtoDriver } from '@/lib/proto-data';
import AdminDrivers from './AdminDrivers';
import AdminChecklistEditor from './AdminChecklistEditor';
import BottomNav from './BottomNav';

type Tab = 'drivers' | 'checklist';

export default function AdminApp({
  admin,
  drivers,
  onAddDriver,
  checklist,
  onChecklistChange,
  onLogout,
}: {
  admin: ProtoDriver;
  drivers: ProtoDriver[];
  onAddDriver: (d: ProtoDriver) => void;
  checklist: ChecklistPhase[];
  onChecklistChange: (next: ChecklistPhase[]) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>('drivers');

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e7e9e2] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-sm font-bold text-[#5e9128]">
            {admin.firstName[0]}{admin.lastName[0]}
          </div>
          <div>
            <div className="text-sm font-semibold">{admin.lastName} {admin.firstName}</div>
            <div className="text-xs font-semibold text-[#8fc640]">Администратор</div>
          </div>
        </div>
        <button onClick={onLogout} className="p-btn p-btn-outline px-4 py-1.5 text-xs">
          Выйти
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto pb-24">
        {tab === 'drivers' && <AdminDrivers drivers={drivers} onAdd={onAddDriver} />}
        {tab === 'checklist' && <AdminChecklistEditor checklist={checklist} onChange={onChecklistChange} />}
      </main>

      <BottomNav
        items={[
          { id: 'drivers', icon: 'id-card', label: 'Водители' },
          { id: 'checklist', icon: 'clipboard', label: 'Чек-лист' },
        ]}
        active={tab}
        onChange={setTab}
      />
    </div>
  );
}
