'use client';

import { useState } from 'react';
import { formatPhoneInput, onlyDigits, SEED_DRIVERS, type ProtoDriver } from '@/lib/proto-data';
import { Icon } from './icons';

type Props = { onLogin: (driver: ProtoDriver) => void };
type Step = 'phone' | 'pin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PhoneLogin({ onLogin }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const phoneDigits = onlyDigits(phone);
  const phoneReady = phoneDigits.length === 11;
  const matchedDriver = SEED_DRIVERS.find((d) => onlyDigits(d.phone) === phoneDigits);

  function goToPin() {
    if (!phoneReady) return;
    setError('');
    setPin('');
    setStep('pin');
  }

  function backToPhone() {
    setStep('phone');
    setPin('');
    setError('');
  }

  function pressKey(k: string) {
    if (pin.length >= 4) return;
    setError('');
    if (k === '⌫') { setPin((p) => p.slice(0, -1)); return; }
    if (k === '') return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) tryLogin(next);
  }

  function tryLogin(candidatePin: string) {
    const driver = matchedDriver;
    if (!driver || driver.pin !== candidatePin) {
      setError('Неверный номер или PIN');
      setShake(true);
      setTimeout(() => { setShake(false); setPin(''); }, 420);
      return;
    }
    onLogin(driver);
  }

  return (
    <div className="mx-auto flex h-full max-w-sm flex-col overflow-y-auto px-6 py-10">
      <div className="p-fade-up mb-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип холдинга, next/image не нужен ради одной иконки */}
        <img src="/ic-group-logo.png" alt="IC Group" className="mx-auto h-16 w-auto" />
        <p className="mt-4 text-sm text-[#5c6066]">Вход в кабинет водителя</p>
      </div>

      {step === 'phone' && (
        <>
          <div className="p-fade-up">
            <label className="p-eyebrow mb-2 block">Номер телефона</label>
            <input
              type="tel"
              inputMode="tel"
              autoFocus
              value={phone}
              onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && goToPin()}
              placeholder="+7 ___ ___ __ __"
              className="p-input text-center text-lg tracking-wide"
            />
            <button
              onClick={goToPin}
              disabled={!phoneReady}
              className="p-btn p-btn-primary mt-4 w-full py-3.5"
            >
              Продолжить
            </button>
          </div>

          <div className="p-fade-up mt-10 rounded-[24px] border border-dashed border-[#e7e9e2] bg-[#f5f6f1] p-4" style={{ animationDelay: '0.05s' }}>
            <p className="p-eyebrow mb-3 text-center">Демо-вход — для обзора прототипа</p>
            <div className="flex flex-col gap-2">
              {SEED_DRIVERS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onLogin(d)}
                  className="flex items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="font-medium">{d.lastName} {d.firstName}</span>
                  <span className="text-xs text-[#9a9d96]">{d.role === 'admin' ? 'администратор' : 'водитель'} · {d.pin}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 'pin' && (
        <div className="p-fade-up">
          <button onClick={backToPhone} className="mb-6 flex items-center gap-1 text-sm font-medium text-[#5c6066] hover:text-[#1a1d1e]">
            <Icon name="chevron-up" size={15} className="-rotate-90" />
            Изменить номер
          </button>

          <div className="mb-7 flex flex-col items-center gap-2.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8fc640]/15 text-base font-bold text-[#5e9128]">
              {matchedDriver ? `${matchedDriver.firstName[0]}${matchedDriver.lastName[0]}` : <Icon name="user" size={22} />}
            </div>
            <p className="text-sm font-semibold">
              {matchedDriver ? `${matchedDriver.lastName} ${matchedDriver.firstName}` : 'Пользователь не найден'}
            </p>
          </div>

          <div className={'mb-6 flex justify-center gap-3 ' + (shake ? 'animate-[shake_0.4s]' : '')}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={
                  'h-3 w-3 rounded-full transition-all duration-200 ' +
                  (i < pin.length ? 'scale-110 bg-[#8fc640]' : 'bg-[#e7e9e2]')
                }
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((k, i) => (
              <button
                key={i}
                type="button"
                disabled={k === ''}
                onClick={() => pressKey(k)}
                className={'p-key flex h-16 items-center justify-center text-xl font-semibold ' + (k === '' ? 'invisible' : k === '⌫' ? 'text-[#9a9d96]' : 'text-[#1a1d1e]')}
              >
                {k === '⌫' ? <Icon name="backspace" size={20} /> : k}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 text-center text-sm font-medium text-[#d9534f]">{error}</p>}
        </div>
      )}
    </div>
  );
}
