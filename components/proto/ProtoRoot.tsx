'use client';

import { useEffect, useState } from 'react';
import { cloneChecklist, SEED_DRIVERS, type ProtoDriver } from '@/lib/proto-data';
import type { ChecklistPhase } from '@/lib/checklist-data';
import PhoneLogin from './PhoneLogin';
import DriverApp from './DriverApp';
import AdminApp from './AdminApp';

const STORAGE_KEY = 'smena_proto_session_v1';

export default function ProtoRoot() {
  const [drivers, setDrivers] = useState<ProtoDriver[]>(SEED_DRIVERS);
  const [checklist, setChecklist] = useState<ChecklistPhase[]>(() => cloneChecklist());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Демонстрация «долгой сессии» — при перезагрузке страницы вход не спрашивается заново.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- одноразовая гидратация демо-сессии из localStorage при монтировании
      if (saved) setCurrentId(saved);
    } catch { /* приватный режим браузера — просто спросим PIN заново */ }
    setReady(true);
  }, []);

  function login(driver: ProtoDriver) {
    setCurrentId(driver.id);
    try { localStorage.setItem(STORAGE_KEY, driver.id); } catch {}
  }

  function logout() {
    setCurrentId(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  if (!ready) return null;

  const current = drivers.find((d) => d.id === currentId) ?? null;

  // flex-col на всю высоту вьюпорта: баннер — своей высоты (shrink-0), под ним
  // единственная область высотой "остаток" (flex-1 min-h-0), внутри которой
  // DriverApp/AdminApp уже сами включают overflow-y-auto на main. Раньше баннер
  // и DriverApp (у которого была своя min-h-dvh) складывались по высоте и
  // получалось больше 100dvh — страница целиком прокручивалась и сквозь верх
  // проглядывал тёмный bg-neutral-950 у <body> (общий для всего приложения).
  return (
    <div className="proto flex h-dvh flex-col">
      <div className="sticky top-0 z-40 shrink-0 bg-[#1a1d1e] px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-white">
        Прототип — демо-данные, ничего не сохраняется на сервере
      </div>

      <div className="min-h-0 flex-1">
        {!current && <PhoneLogin onLogin={login} />}

        {current && current.role === 'driver' && (
          <DriverApp driver={current} checklist={checklist} onLogout={logout} />
        )}

        {current && current.role === 'admin' && (
          <AdminApp
            admin={current}
            drivers={drivers}
            onAddDriver={(d) => setDrivers((prev) => [...prev, d])}
            checklist={checklist}
            onChecklistChange={setChecklist}
            onLogout={logout}
          />
        )}
      </div>
    </div>
  );
}
