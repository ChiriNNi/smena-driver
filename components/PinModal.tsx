'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  title: string;
  message: string;
  onSubmit: (pin: string) => Promise<string | null>; // возвращает текст ошибки или null при успехе
  onClose: () => void;
};

export default function PinModal({ title, message, onSubmit, onClose }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit() {
    setBusy(true);
    const err = await onSubmit(pin);
    setBusy(false);
    if (err) { setError(err); setPin(''); inputRef.current?.focus(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-neutral-100">{title}</h3>
        <p className="mt-1 text-sm text-neutral-400">{message}</p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="mt-4 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-center text-lg tracking-[0.4em] text-neutral-100 outline-none focus:border-amber-500"
          placeholder="••••"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm text-neutral-300 hover:border-neutral-500"
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={busy || pin.length < 4}
            className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400 disabled:opacity-50"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
