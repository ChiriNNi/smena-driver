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
    // Экран занимает всю высоту: заголовок сверху, поля по центру, клавиатура
    // и главная кнопка — внизу, в зоне большого пальца. overflow-y-auto нужен
    // на случай маленького экрана или альбомной ориентации.
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-sm flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-8">
        {step === 'phone' ? (
          <>
            {/* На первом шаге логотип идёт вместе с полем одним блоком по центру:
                прижатый к верху, он отрывался от единственного поля на экране и
                висел сам по себе. */}
            <div className="p-fade-up flex flex-1 flex-col pb-8 pt-[7vh]">
              <div className="mb-7 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип холдинга, next/image не нужен ради одной картинки */}
                <img src="/ic-group-logo.png" alt="IC Group" className="mx-auto h-14 w-auto" />
                <p className="mt-3 text-sm text-[#5c6066]">Вход в кабинет</p>
              </div>

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
                className="p-input py-4 text-center text-xl tracking-wide"
              />
              <p className="mt-6 text-center text-xs leading-relaxed text-[#9a9d96]">
                Доступ выдаёт администратор. Если войти не получается — обратитесь к нему, он проверит номер и сбросит
                PIN.
              </p>
            </div>

            <button onClick={goToPin} disabled={!phoneReady} className="p-btn p-btn-primary w-full py-4 text-base">
              Продолжить
            </button>
          </>
        ) : (
          <>
            {/* На шаге PIN логотип остаётся сверху: снизу его место занимает
                клавиатура, и экран заполнен по всей высоте. */}
            <div className="p-fade-up text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип холдинга, next/image не нужен ради одной картинки */}
              <img src="/ic-group-logo.png" alt="IC Group" className="mx-auto h-14 w-auto" />
              <p className="mt-3 text-sm text-[#5c6066]">Вход в кабинет</p>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-4">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
                <Icon name="user" size={26} />
              </div>
              <p className="text-base font-semibold tabular-nums">{phone}</p>
              <button
                onClick={backToPhone}
                className="mt-1 flex items-center gap-1 text-xs font-medium text-[#9a9d96] hover:text-[#5c6066]"
              >
                <Icon name="chevron-up" size={12} className="-rotate-90" />
                Изменить номер
              </button>

              <div className={'mt-7 flex justify-center gap-4 ' + (shake ? 'animate-[shake_0.4s]' : '')}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={
                      'h-3.5 w-3.5 rounded-full transition-all duration-200 ' +
                      (i < pin.length ? 'scale-110 bg-[#8fc640]' : 'bg-[#e7e9e2]')
                    }
                  />
                ))}
              </div>

              {/* Место под сообщение об ошибке занято всегда — иначе клавиатура
                  подпрыгивает, когда PIN не подошёл. */}
              <p className="mt-4 min-h-[2.5rem] px-2 text-center text-sm font-medium leading-snug text-[#d9534f]">
                {error}
              </p>
            </div>

            <div className={'grid grid-cols-3 gap-2.5 transition-opacity ' + (busy ? 'pointer-events-none opacity-50' : '')}>
              {KEYS.map((k, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={k === ''}
                  onClick={() => pressKey(k)}
                  className={
                    'p-key flex h-[clamp(60px,10.5vh,86px)] items-center justify-center text-[26px] font-semibold ' +
                    (k === '' ? 'invisible' : k === '⌫' ? 'text-[#9a9d96]' : 'text-[#1a1d1e]')
                  }
                >
                  {k === '⌫' ? <Icon name="backspace" size={22} /> : k}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
