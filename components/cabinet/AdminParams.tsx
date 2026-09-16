'use client';

import { useState } from 'react';
import { formatPhoneInput, onlyDigits } from '@/lib/labels';
import type { AppSettings } from '@/lib/settings';
import { useSession } from './session';
import { Field, SectionHeader } from './ui';

// Параметры работы кабинета.
//
// Эти значения и раньше лежали в базе, и сервер их читал, — но менять их было
// негде: экрана не существовало, и «5 вопросов из банка, 5 верных для допуска»
// можно было поправить только запросом в базу руками.

const NUMBERS: {
  key: 'quizPerAttempt' | 'quizPassScore' | 'briefingFreshHours';
  label: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  {
    key: 'quizPerAttempt',
    label: 'Вопросов в тесте',
    hint: 'Сколько вопросов достаётся водителю из банка перед сменой.',
    min: 1,
    max: 50,
  },
  {
    key: 'quizPassScore',
    label: 'Верных для допуска',
    hint: 'Больше числа вопросов быть не может — тогда тест не сдать вовсе.',
    min: 1,
    max: 50,
  },
  {
    key: 'briefingFreshHours',
    label: 'Тест действует, часов',
    hint: 'Если смена так и не началась. Перед каждой сменой тест всё равно проходится заново.',
    min: 1,
    max: 720,
  },
];

export default function AdminParams() {
  const { settings, saveSettings } = useSession();
  const [form, setForm] = useState(() => ({
    quizPerAttempt: String(settings?.quizPerAttempt ?? 5),
    quizPassScore: String(settings?.quizPassScore ?? 5),
    briefingFreshHours: String(settings?.briefingFreshHours ?? 24),
    whatsappTarget: settings?.whatsappTarget ? formatPhoneInput(settings.whatsappTarget) : '',
  }));
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  if (!settings) return <p className="px-1 py-6 text-center text-sm text-[#9a9d96]">Загружаем настройки…</p>;

  const numbers = NUMBERS.map((f) => ({ ...f, value: Number(form[f.key]) }));
  const outOfRange = numbers.find((f) => !Number.isFinite(f.value) || f.value < f.min || f.value > f.max);
  const passTooHigh = Number(form.quizPassScore) > Number(form.quizPerAttempt);
  const phoneDigits = onlyDigits(form.whatsappTarget);
  const phoneBroken = form.whatsappTarget.trim() !== '' && phoneDigits.length !== 11;

  const problem = outOfRange
    ? `«${outOfRange.label}»: допустимо от ${outOfRange.min} до ${outOfRange.max}.`
    : passTooHigh
      ? 'Верных ответов нужно не больше, чем вопросов в тесте.'
      : phoneBroken
        ? 'Номер получателя должен быть в формате +7 7XX XXX XX XX.'
        : '';

  async function save() {
    if (problem) return;
    setState('saving');
    setError('');
    try {
      const patch: Partial<AppSettings> = {
        quizPerAttempt: Number(form.quizPerAttempt),
        quizPassScore: Number(form.quizPassScore),
        briefingFreshHours: Number(form.briefingFreshHours),
        whatsappTarget: phoneDigits,
      };
      await saveSettings(patch);
      setState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки.');
      setState('idle');
    }
  }

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setState('idle');
  };

  return (
    <>
      <SectionHeader title="Инструктаж по ТБ" hint="как водитель получает допуск к смене" />

      <div className="p-card flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          {numbers.slice(0, 2).map((f) => (
            <Field
              key={f.key}
              label={f.label}
              inputMode="numeric"
              value={form[f.key]}
              onChange={(e) => set({ [f.key]: e.target.value.replace(/\D/g, '') } as Partial<typeof form>)}
            />
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-[#9a9d96]">
          {numbers[0].hint} {numbers[1].hint}
        </p>

        <Field
          label={numbers[2].label}
          inputMode="numeric"
          value={form.briefingFreshHours}
          onChange={(e) => set({ briefingFreshHours: e.target.value.replace(/\D/g, '') })}
          hint={numbers[2].hint}
        />
      </div>

      <SectionHeader title="Отправка сводки" hint="куда уходит отчёт по смене" />

      <div className="p-card p-4">
        <Field
          label="Номер получателя в WhatsApp"
          inputMode="tel"
          value={form.whatsappTarget}
          onChange={(e) => set({ whatsappTarget: formatPhoneInput(e.target.value) })}
          placeholder="+7 777 044 45 56"
          hint="Пусто — водитель сам выбирает чат при отправке, включая группу."
        />
      </div>

      {problem && <p className="text-xs leading-relaxed font-semibold text-[#c0564a]">{problem}</p>}
      {error && <p className="text-xs leading-relaxed font-semibold text-[#c0564a]">{error}</p>}

      <button onClick={save} disabled={state === 'saving' || !!problem} className="p-btn p-btn-primary py-3 text-xs">
        {state === 'saving' ? 'Сохраняем…' : state === 'saved' ? 'Сохранено' : 'Сохранить настройки'}
      </button>
    </>
  );
}
