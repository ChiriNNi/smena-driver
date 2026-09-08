'use client';

import { useState } from 'react';
import { CARS, formatPhoneInput, onlyDigits, pinFromPhone, type ProtoDriver } from '@/lib/proto-data';

export default function AdminDrivers({ drivers, onAdd }: { drivers: ProtoDriver[]; onAdd: (d: ProtoDriver) => void }) {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [car, setCar] = useState(CARS[0]);
  const [createdPin, setCreatedPin] = useState<string | null>(null);

  const canSubmit = lastName.trim() && firstName.trim() && onlyDigits(phone).length === 11;

  function submit() {
    if (!canSubmit) return;
    const pin = pinFromPhone(phone);
    onAdd({ id: crypto.randomUUID(), lastName: lastName.trim(), firstName: firstName.trim(), phone, car, pin, role: 'driver' });
    setCreatedPin(pin);
    setLastName(''); setFirstName(''); setPhone(''); setCar(CARS[0]);
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="p-card p-4">
        <h2 className="mb-3 text-sm font-bold">Добавить водителя</h2>
        <div className="flex flex-col gap-3">
          <div><label className="p-eyebrow mb-1.5 block">Фамилия</label><input className="p-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ахметов" /></div>
          <div><label className="p-eyebrow mb-1.5 block">Имя</label><input className="p-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Данияр" /></div>
          <div><label className="p-eyebrow mb-1.5 block">Номер телефона</label><input className="p-input" inputMode="tel" value={phone} onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setCreatedPin(null); }} placeholder="+7 ___ ___ __ __" /></div>
          <div>
            <label className="p-eyebrow mb-1.5 block">Авто по умолчанию</label>
            <select className="p-input" value={car} onChange={(e) => setCar(e.target.value)}>
              {CARS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={!canSubmit} className="p-btn p-btn-primary py-3">Создать профиль</button>
          {createdPin && (
            <p className="p-fade-up rounded-2xl bg-[#8fc640]/12 px-3.5 py-2.5 text-xs leading-relaxed text-[#5e9128]">
              Готово. PIN для входа водителя — <b className="tabular-nums">{createdPin}</b> (последние 4 цифры номера). Сообщите его водителю лично.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="p-eyebrow mb-2">Все аккаунты</h2>
        <div className="flex flex-col gap-2">
          {drivers.map((d) => (
            <div key={d.id} className="p-card flex items-center justify-between p-3.5">
              <div>
                <p className="text-sm font-medium">{d.lastName} {d.firstName}</p>
                <p className="text-xs text-[#9a9d96]">{d.phone} · {d.car}</p>
              </div>
              <span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + (d.role === 'admin' ? 'bg-[#8fc640]/15 text-[#5e9128]' : 'bg-white text-[#9a9d96] ring-1 ring-inset ring-[#e7e9e2]')}>
                {d.role === 'admin' ? 'админ' : 'водитель'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
