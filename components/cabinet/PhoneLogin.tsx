'use client';

import { useState } from 'react';
import { formatPhoneInput, onlyDigits } from '@/lib/labels';
import { useSession } from './session';
import { Icon } from './icons';

// Вход в кабинет: номер телефона, затем PIN.
//
// Имя владельца номера на экране PIN не показывается: до успешного входа
// сервер не подтверждает, зарегистрирован ли такой номер вообще — иначе форма
// входа превращается в способ узнать, кто работает в компании.

type Step = 'phone' | 'pin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PhoneLogin() {
  const { login } = useSession();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const phoneDigits = onlyDigits(phone);
  const phoneReady = phoneDigits.length === 11;

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
    if (busy || pin.length >= 4) return;
    setError('');
    if (k === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (k === '') return;
    const next = pin + k;
    setPin(next);
    // Четвёртая цифра сразу отправляет форму — отдельная кнопка «Войти»
    // на морозе в перчатках только мешает.
    if (next.length === 4) void submit(next);
  }

  async function submit(candidate: string) {
    setBusy(true);
    try {
      await login(phone, candidate);
      // При успехе компонент размонтируется — состояние сбрасывать не нужно.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти.');
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin('');
      }, 420);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-sm flex-col overflow-y-auto px-6 py-10">
      <div className="p-fade-up mb-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип холдинга, next/image не нужен ради одной картинки */}
        <img src="/ic-group-logo.png" alt="IC Group" className="mx-auto h-16 w-auto" />
        <p className="mt-4 text-sm text-[#5c6066]">Вход в кабинет</p>
      </div>

      {step === 'phone' && (
        <div className="p-fade-up">
          <label className="p-eyebrow mb-2 block">Номер телефона</label>
          <input
            type="tel"
            inputMode="tel"
            autoFocus
            value={phone}
            onChange={(e) => {
              setPhone(formatPhoneInput(e.target.value));
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && goToPin()}
            placeholder="+7 ___ ___ __ __"
            className="p-input text-center text-lg tracking-wide"
          />
          <button onClick={goToPin} disabled={!phoneReady} className="p-btn p-btn-primary mt-4 w-full py-3.5">
            Продолжить
          </button>

          <p className="mt-8 text-center text-xs leading-relaxed text-[#9a9d96]">
            Доступ выдаёт администратор. Если войти не получается — обратитесь к нему, он проверит номер и сбросит PIN.
          </p>
        </div>
      )}

      {step === 'pin' && (
        <div className="p-fade-up">
          <button
            onClick={backToPhone}
            className="mb-6 flex items-center gap-1 text-sm font-medium text-[#5c6066] hover:text-[#1a1d1e]"
          >
            <Icon name="chevron-up" size={15} className="-rotate-90" />
            Изменить номер
          </button>

          <div className="mb-7 flex flex-col items-center gap-2.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
              <Icon name="user" size={22} />
            </div>
            <p className="text-sm font-semibold tabular-nums">{phone}</p>
            <p className="text-xs text-[#9a9d96]">Введите PIN</p>
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

          <div className={'grid grid-cols-3 gap-3 transition-opacity ' + (busy ? 'pointer-events-none opacity-50' : '')}>
            {KEYS.map((k, i) => (
              <button
                key={i}
                type="button"
                disabled={k === ''}
                onClick={() => pressKey(k)}
                className={
                  'p-key flex h-16 items-center justify-center text-xl font-semibold ' +
                  (k === '' ? 'invisible' : k === '⌫' ? 'text-[#9a9d96]' : 'text-[#1a1d1e]')
                }
              >
                {k === '⌫' ? <Icon name="backspace" size={20} /> : k}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 text-center text-sm font-medium leading-relaxed text-[#d9534f]">{error}</p>}
        </div>
      )}
    </div>
  );
}
