'use client';

import { carLabel, formatDate, initials, type ProtoDriver } from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { CardTitle, Pill, SectionHeader } from './ui';

// Профиль водителя: свои данные, правила ТБ и статус ознакомления, выход.

export default function ProfileTab({
  driver,
  onLogout,
  onSendWhatsApp,
}: {
  driver: ProtoDriver;
  onLogout: () => void;
  onSendWhatsApp: () => void;
}) {
  const { cars, rules, acks } = useStore();
  const ack = acks.filter((a) => a.driverId === driver.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="p-card p-fade-up p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8fc640]/15 text-xl font-bold text-[#5e9128]">
          {initials(driver)}
        </div>
        <h2 className="mt-3 text-base font-bold">
          {driver.lastName} {driver.firstName}
        </h2>
        <p className="text-sm text-[#5c6066]">{driver.phone}</p>
        <div className="mt-4 flex flex-col gap-2 border-t border-[#e7e9e2] pt-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[#9a9d96]">Авто по умолчанию</span>
            <span className="text-right font-medium">{carLabel(cars, driver.carId)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#9a9d96]">В компании с</span>
            <span className="font-medium">{formatDate(driver.hiredAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#9a9d96]">Инструктаж по ТБ</span>
            {ack ? (
              <Pill tone={ack.score === ack.total ? 'good' : 'warn'}>
                {ack.score}/{ack.total} · {formatDate(ack.date)}
              </Pill>
            ) : (
              <Pill tone="bad">не пройден</Pill>
            )}
          </div>
        </div>
      </div>

      <button onClick={onSendWhatsApp} className="p-btn p-btn-outline flex items-center justify-center gap-1.5 py-3 text-xs">
        <Icon name="arrow-right" size={14} />
        Отправить сводку текущей смены в WhatsApp
      </button>

      {rules.length > 0 && (
        <>
          <SectionHeader title="Правила и техника безопасности" />
          <div className="p-card p-4">
            <CardTitle icon="shield" title={`Свод правил · ${rules.length}`} />
            <div className="flex flex-col">
              {rules.map((rule, i) => (
                <div key={rule.id} className="p-card-line py-2.5 last:border-none">
                  <p className="text-sm font-semibold">
                    {i + 1}. {rule.title}
                  </p>
                  {rule.body && <p className="mt-1 text-xs leading-relaxed text-[#5c6066]">{rule.body}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="rounded-2xl border border-dashed border-[#e7e9e2] bg-[#f5f6f1] p-3.5 text-xs leading-relaxed text-[#5c6066]">
        Сессия действует 30 дней и продлевается при каждом заходе — PIN не спросит заново, пока вы пользуетесь кабинетом
        хотя бы раз в этот срок.
      </div>

      <button onClick={onLogout} className="p-btn p-btn-outline py-3">
        Выйти
      </button>
    </div>
  );
}
