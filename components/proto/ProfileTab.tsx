'use client';

import type { ProtoDriver } from '@/lib/proto-data';

type Props = { driver: ProtoDriver; onLogout: () => void };

export default function ProfileTab({ driver, onLogout }: Props) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="p-card p-fade-up p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8fc640]/15 text-xl font-bold text-[#5e9128]">
          {driver.firstName[0]}{driver.lastName[0]}
        </div>
        <h2 className="mt-3 text-base font-bold">{driver.lastName} {driver.firstName}</h2>
        <p className="text-sm text-[#5c6066]">{driver.phone}</p>
        <div className="mt-4 flex flex-col gap-2 border-t border-[#e7e9e2] pt-3 text-sm">
          <div className="flex justify-between"><span className="text-[#9a9d96]">Авто по умолчанию</span><span className="font-medium">{driver.car}</span></div>
          <div className="flex justify-between"><span className="text-[#9a9d96]">Роль</span><span className="font-medium">{driver.role === 'admin' ? 'Администратор' : 'Водитель'}</span></div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-[#e7e9e2] bg-[#f5f6f1] p-3.5 text-xs leading-relaxed text-[#5c6066]">
        Сессия действует 30 дней и продлевается при каждом заходе — PIN не спросит заново, пока вы пользуетесь кабинетом хотя бы раз в этот срок.
      </div>

      <button onClick={onLogout} className="p-btn p-btn-outline py-3">Выйти</button>
    </div>
  );
}
