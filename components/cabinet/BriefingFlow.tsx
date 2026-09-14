'use client';

import { useState } from 'react';
import * as api from '@/lib/api';
import { formatDate } from '@/lib/labels';
import type { BriefingReason } from '@/lib/model';
import { useSession } from './session';
import RegulationsView from './RegulationsView';
import { Icon } from './icons';
import { Pill } from './ui';

// Инструктаж по ТБ перед сменой: регламенты → тест → разбор.
//
// Вопросы выдаёт сервер случайной выборкой из общего банка и он же проверяет
// ответы: правильные варианты в браузер не попадают, а заучить «ответы по
// порядку» нельзя — набор каждый раз другой.

type Step = 'rules' | 'quiz' | 'result' | 'sign';

/** Почему допуска сейчас нет — этим объясняем водителю, зачем он снова здесь. */
const REASON_TEXT: Record<BriefingReason, string> = {
  ok: '',
  'not-passed': 'Тест ещё не пройден.',
  failed: 'Прошлая попытка не сдана.',
  'not-signed': 'Тест сдан, осталось подписать ознакомление.',
  used: 'По прошлой сдаче смена уже закрыта — перед новой сменой тест проходится заново.',
  stale: 'С прошлой сдачи прошло слишком много времени, а смена так и не началась.',
};

export default function BriefingFlow({ onDone, onExit }: { onDone: () => void | Promise<void>; onExit?: () => void }) {
  const { user, briefing, refreshBriefing } = useSession();

  // Тест уже сдан, не хватает подписи (например, приложение закрыли на этом
  // шаге) — продолжаем с подписи, а не гоняем человека по вопросам заново.
  const pending = briefing?.pendingSignature ?? null;
  const [step, setStep] = useState<Step>(pending ? 'sign' : 'rules');
  const [signedAttemptId, setSignedAttemptId] = useState<string | null>(pending?.attemptId ?? null);
  const [signing, setSigning] = useState(false);
  const [attempt, setAttempt] = useState<api.StartedAttempt | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<api.AttemptResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const previous = briefing?.latest ?? null;
  const perAttempt = briefing?.questionsPerAttempt ?? 5;
  const passScore = attempt?.passScore ?? briefing?.passScore ?? perAttempt;

  async function startQuiz() {
    setBusy(true);
    setError('');
    try {
      const started = await api.quiz.start();
      setAttempt(started);
      setAnswers({});
      setIndex(0);
      setStep('quiz');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось начать тест.');
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!attempt) return;
    if (index + 1 < attempt.questions.length) {
      setIndex((i) => i + 1);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await api.quiz.submit(attempt.attemptId, answers);
      setResult(res);
      setSignedAttemptId(res.passed ? attempt.attemptId : null);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить ответы.');
    } finally {
      setBusy(false);
    }
  }

  /** Подпись: ФИО подставляет сервер из профиля, водитель только подтверждает. */
  async function sign() {
    if (!signedAttemptId) return;
    setSigning(true);
    setError('');
    try {
      await api.quiz.sign(signedAttemptId);
      await refreshBriefing();
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подписать ознакомление.');
    } finally {
      setSigning(false);
    }
  }

  /* ─── Шаг подписи ──────────────────────────────────────────────────────── */

  if (step === 'sign') {
    const score = result ? `${result.score} из ${result.total}` : pending ? `${pending.score} из ${pending.total}` : '';
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="p-fade-up mx-auto max-w-xs text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
            <Icon name="pencil" size={24} />
          </div>
          <h2 className="text-lg font-bold">Подпись об ознакомлении</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#5c6066]">
            Тест сдан{score ? ` — ${score} верно` : ''}. Подтвердите, что ознакомились с обязанностями и правилами.
          </p>
        </div>

        <div className="p-card p-5">
          <p className="p-eyebrow mb-1.5">Подписывает</p>
          <p className="text-base font-bold">
            {user?.lastName} {user?.firstName}
          </p>
          <p className="mt-0.5 text-xs text-[#9a9d96]">{user?.phone}</p>

          <div className="mt-4 border-t border-dashed border-[#e7e9e2] pt-3">
            <p className="text-xs leading-relaxed text-[#5c6066]">
              Нажимая «Подписать», вы подтверждаете, что прочитали действующий регламент, поняли его и обязуетесь
              соблюдать. Дата и время подписи сохраняются в журнале.
            </p>
          </div>
        </div>

        {error && <p className="text-center text-sm font-medium text-[#c0564a]">{error}</p>}

        <button
          onClick={() => void sign()}
          disabled={signing}
          className="p-btn p-btn-primary flex items-center justify-center gap-1.5 py-3.5"
        >
          {signing ? 'Подписываем…' : 'Подписать и приступить к смене'}
          {!signing && <Icon name="check" size={16} />}
        </button>

        <button onClick={() => setStep('rules')} className="p-btn p-btn-outline py-3 text-xs">
          Перечитать регламент
        </button>
      </div>
    );
  }

  /* ─── Шаг 1. Регламенты ────────────────────────────────────────────────── */

  if (step === 'rules') {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="p-fade-up mx-auto max-w-xs text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
            <Icon name="shield" size={22} />
          </div>
          <h2 className="text-lg font-bold">Инструктаж перед сменой</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#5c6066]">
            Ознакомьтесь с регламентом — дальше {perAttempt}{' '}
            {perAttempt === 1 ? 'вопрос' : perAttempt < 5 ? 'вопроса' : 'вопросов'} из общего списка, выбранных
            случайно.
          </p>
        </div>

        {briefing && briefing.reason !== 'ok' && (
          <div className="flex items-start gap-2 rounded-2xl border border-dashed border-[#e7e9e2] bg-[#f5f6f1] p-3.5">
            <Icon name="clock" size={15} className="mt-0.5 shrink-0 text-[#9a9d96]" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-[#5c6066]">
              {REASON_TEXT[briefing.reason]}
              {previous && ` Прошлый результат: ${previous.score}/${previous.total} от ${formatDate(previous.date)}.`}
            </p>
          </div>
        )}

        <RegulationsView compact />

        {error && <p className="text-center text-sm font-medium text-[#c0564a]">{error}</p>}

        <button
          onClick={() => void startQuiz()}
          disabled={busy}
          className="p-btn p-btn-primary flex items-center justify-center gap-1.5 py-3.5"
        >
          {busy ? 'Готовим вопросы…' : 'Ознакомился, перейти к тесту'}
          {!busy && <Icon name="arrow-right" size={15} />}
        </button>

        {onExit && (
          <button onClick={onExit} className="p-btn p-btn-outline py-3 text-xs">
            Позже
          </button>
        )}
      </div>
    );
  }

  /* ─── Шаг 2. Вопросы ───────────────────────────────────────────────────── */

  if (step === 'quiz' && attempt) {
    const current = attempt.questions[index];
    const answered = answers[current.id] !== undefined;
    const total = attempt.questions.length;

    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="p-eyebrow">
              Вопрос {index + 1} из {total}
            </p>
            <span className="text-xs font-semibold tabular-nums text-[#9a9d96]">
              {Math.round(((index + (answered ? 1 : 0)) / total) * 100)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e9e2]">
            <div
              className="h-full rounded-full bg-[#8fc640] transition-all duration-300"
              style={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>

        <div key={current.id} className="p-fade-up flex flex-col gap-4">
          <h2 className="text-base font-bold leading-snug">{current.question}</h2>

          <div className="flex flex-col gap-2">
            {current.options.map((option, oi) => {
              const selected = answers[current.id] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => setAnswers((a) => ({ ...a, [current.id]: oi }))}
                  className={
                    'flex items-center gap-3 rounded-2xl p-3.5 text-left transition ' +
                    (selected
                      ? 'bg-[#8fc640]/12 ring-2 ring-inset ring-[#8fc640]'
                      : 'bg-[#f5f6f1] ring-1 ring-inset ring-[#e7e9e2] hover:ring-[#d7dacf]')
                  }
                >
                  <span
                    className={
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ' +
                      (selected ? 'border-[#8fc640] bg-[#8fc640] text-white' : 'border-[#d7dacf] bg-white text-transparent')
                    }
                  >
                    <Icon name="check" size={13} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-center text-sm font-medium text-[#c0564a]">{error}</p>}

        <div className="flex gap-2">
          {index > 0 && (
            <button onClick={() => setIndex((i) => i - 1)} className="p-btn p-btn-outline flex-1 py-3.5 text-xs">
              Назад
            </button>
          )}
          <button
            onClick={() => void next()}
            disabled={!answered || busy}
            className="p-btn p-btn-primary flex flex-[2] items-center justify-center gap-1.5 py-3.5"
          >
            {busy ? 'Проверяем…' : index + 1 === total ? 'Завершить тест' : 'Далее'}
            {!busy && <Icon name="arrow-right" size={15} />}
          </button>
        </div>

        <p className="text-center text-[11px] text-[#9a9d96]">
          Для допуска нужно {passScore} из {total} верных ответов
        </p>
      </div>
    );
  }

  /* ─── Шаг 3. Результат ─────────────────────────────────────────────────── */

  if (!result) return null;
  const passed = result.passed;

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="p-fade-up mx-auto max-w-xs text-center">
        <div
          className={
            'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ' +
            (passed ? 'bg-[#8fc640]/15 text-[#5e9128]' : 'bg-[#b5811c]/12 text-[#96690f]')
          }
        >
          <Icon name={passed ? 'check-circle' : 'warning'} size={26} />
        </div>
        <h2 className="text-lg font-bold">{passed ? 'Инструктаж пройден' : 'Есть ошибки'}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#5c6066]">
          {result.score} из {result.total} верно.{' '}
          {passed ? 'Допуск к этой смене открыт.' : 'Разберите ошибки и пройдите тест заново.'}
        </p>
      </div>

      <div className="p-card p-4">
        <p className="p-eyebrow mb-2">Разбор ответов</p>
        <div className="flex flex-col">
          {result.review.map((r, i) => {
            const correct = r.given === r.correct;
            return (
              <div key={r.id} className="p-card-line py-2.5 last:border-none">
                <div className="flex items-start gap-2">
                  <Icon
                    name={correct ? 'check' : 'x'}
                    size={14}
                    className={'mt-0.5 shrink-0 ' + (correct ? 'text-[#5e9128]' : 'text-[#c0564a]')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {i + 1}. {r.question}
                    </p>
                    {!correct && (
                      <div className="mt-1 flex flex-col gap-0.5 text-xs">
                        <p className="text-[#c0564a]">Ваш ответ: {r.given === null ? '—' : r.options[r.given]}</p>
                        <p className="text-[#5e9128]">Верно: {r.options[r.correct]}</p>
                        {r.topic && <p className="text-[#9a9d96]">Раздел регламента: {r.topic}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {passed ? (
        <button onClick={() => setStep('sign')} className="p-btn p-btn-primary flex items-center justify-center gap-1.5 py-3.5">
          Перейти к подписи
          <Icon name="arrow-right" size={15} />
        </button>
      ) : (
        <>
          <button onClick={() => void startQuiz()} disabled={busy} className="p-btn p-btn-primary py-3.5">
            {busy ? 'Готовим вопросы…' : 'Пройти тест заново'}
          </button>
          <button onClick={() => setStep('rules')} className="p-btn p-btn-outline py-3 text-xs">
            Перечитать регламент
          </button>
        </>
      )}

      <div className="flex justify-center">
        <Pill tone={passed ? 'good' : 'warn'}>
          Результат записан: {result.score}/{result.total}
        </Pill>
      </div>
    </div>
  );
}
