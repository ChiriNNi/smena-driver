'use client';

import { useMemo, useState } from 'react';
import { formatDate, latestAck, todayISO, uid, type ProtoDriver } from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { EmptyState, Pill } from './ui';

// Инструктаж по ТБ: правила → тест по одному вопросу → разбор результата.
// Проверка ответов здесь клиентская, потому что это прототип. В проде вопросы
// приходят без поля correct, а ответы проверяет сервер — иначе правильные
// варианты видно в исходниках страницы.

type Step = 'rules' | 'quiz' | 'result';

export default function BriefingFlow({
  driver,
  onDone,
  onExit,
}: {
  driver: ProtoDriver;
  onDone: () => void;
  onExit?: () => void;
}) {
  const { rules, quiz, acks, addAck } = useStore();
  const [step, setStep] = useState<Step>('rules');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const previous = latestAck(acks, driver.id);
  const score = useMemo(() => quiz.filter((q) => answers[q.id] === q.correct).length, [quiz, answers]);
  const allCorrect = quiz.length > 0 && score === quiz.length;
  const current = quiz[index];

  function startQuiz() {
    setAnswers({});
    setIndex(0);
    setStep('quiz');
  }

  function next() {
    if (index + 1 < quiz.length) {
      setIndex((i) => i + 1);
      return;
    }
    // Записываем попытку с любым результатом — администратор видит актуальный.
    addAck({ id: uid('ak'), driverId: driver.id, date: todayISO(), score, total: quiz.length });
    setStep('result');
  }

  /* ─── Тест не настроен ─────────────────────────────────────────────────── */

  if (quiz.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-5 py-8">
        <EmptyState
          icon="shield"
          title="Тест по ТБ не настроен"
          hint="Администратор ещё не добавил вопросы. Можно приступать к смене."
        />
        <button onClick={onDone} className="p-btn p-btn-primary py-3.5">
          Приступить к смене
        </button>
      </div>
    );
  }

  /* ─── Шаг 1. Правила ───────────────────────────────────────────────────── */

  if (step === 'rules') {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="p-fade-up mx-auto max-w-xs text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
            <Icon name="shield" size={22} />
          </div>
          <h2 className="text-lg font-bold">Инструктаж по ТБ</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#5c6066]">
            Прочитайте правила — дальше {quiz.length}{' '}
            {quiz.length === 1 ? 'вопрос' : quiz.length < 5 ? 'вопроса' : 'вопросов'} на проверку.
          </p>
        </div>

        {previous && (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[#e7e9e2] bg-[#f5f6f1] p-3.5">
            <Icon name="clock" size={15} className="shrink-0 text-[#9a9d96]" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-[#5c6066]">
              Прошлая попытка: {previous.score}/{previous.total} от {formatDate(previous.date)}.{' '}
              {previous.score < previous.total ? 'Были ошибки — нужно пройти заново.' : 'Срок действия истёк.'}
            </p>
          </div>
        )}

        {rules.map((rule, i) => (
          <div key={rule.id} className="p-card p-fade-up p-4" style={{ animationDelay: `${Math.min(i, 6) * 0.04}s` }}>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold tabular-nums text-[#5e9128] ring-1 ring-inset ring-[#e7e9e2]">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{rule.title}</p>
                {rule.body && <p className="mt-1 text-xs leading-relaxed text-[#5c6066]">{rule.body}</p>}
              </div>
            </div>
          </div>
        ))}

        <button onClick={startQuiz} className="p-btn p-btn-primary flex items-center justify-center gap-1.5 py-3.5">
          Перейти к тесту
          <Icon name="arrow-right" size={15} />
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

  if (step === 'quiz') {
    const answered = answers[current.id] !== undefined;
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="p-eyebrow">
              Вопрос {index + 1} из {quiz.length}
            </p>
            <span className="text-xs font-semibold tabular-nums text-[#9a9d96]">
              {Math.round(((index + (answered ? 1 : 0)) / quiz.length) * 100)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e9e2]">
            <div
              className="h-full rounded-full bg-[#8fc640] transition-all duration-300"
              style={{ width: `${((index + (answered ? 1 : 0)) / quiz.length) * 100}%` }}
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

        <div className="flex gap-2">
          {index > 0 && (
            <button onClick={() => setIndex((i) => i - 1)} className="p-btn p-btn-outline flex-1 py-3.5 text-xs">
              Назад
            </button>
          )}
          <button
            onClick={next}
            disabled={!answered}
            className="p-btn p-btn-primary flex flex-[2] items-center justify-center gap-1.5 py-3.5"
          >
            {index + 1 === quiz.length ? 'Завершить тест' : 'Далее'}
            <Icon name="arrow-right" size={15} />
          </button>
        </div>
      </div>
    );
  }

  /* ─── Шаг 3. Результат ─────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="p-fade-up mx-auto max-w-xs text-center">
        <div
          className={
            'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ' +
            (allCorrect ? 'bg-[#8fc640]/15 text-[#5e9128]' : 'bg-[#b5811c]/12 text-[#96690f]')
          }
        >
          <Icon name={allCorrect ? 'check-circle' : 'warning'} size={26} />
        </div>
        <h2 className="text-lg font-bold">{allCorrect ? 'Инструктаж пройден' : 'Есть ошибки'}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#5c6066]">
          {score} из {quiz.length} верно.{' '}
          {allCorrect ? 'Допуск к смене открыт на 30 дней.' : 'Разберите ошибки и пройдите тест заново.'}
        </p>
      </div>

      <div className="p-card p-4">
        <p className="p-eyebrow mb-2">Разбор ответов</p>
        <div className="flex flex-col">
          {quiz.map((q, i) => {
            const given = answers[q.id];
            const correct = given === q.correct;
            return (
              <div key={q.id} className="p-card-line py-2.5 last:border-none">
                <div className="flex items-start gap-2">
                  <Icon
                    name={correct ? 'check' : 'x'}
                    size={14}
                    className={'mt-0.5 shrink-0 ' + (correct ? 'text-[#5e9128]' : 'text-[#c0564a]')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {i + 1}. {q.question}
                    </p>
                    {!correct && (
                      <div className="mt-1 flex flex-col gap-0.5 text-xs">
                        <p className="text-[#c0564a]">Ваш ответ: {q.options[given] ?? '—'}</p>
                        <p className="text-[#5e9128]">Верно: {q.options[q.correct]}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {allCorrect ? (
        <button onClick={onDone} className="p-btn p-btn-primary flex items-center justify-center gap-1.5 py-3.5">
          Приступить к смене
          <Icon name="arrow-right" size={15} />
        </button>
      ) : (
        <>
          <button onClick={startQuiz} className="p-btn p-btn-primary py-3.5">
            Пройти тест заново
          </button>
          <button onClick={() => setStep('rules')} className="p-btn p-btn-outline py-3 text-xs">
            Перечитать правила
          </button>
        </>
      )}

      <div className="flex justify-center">
        <Pill tone={allCorrect ? 'good' : 'warn'}>
          Результат записан: {score}/{quiz.length} · {formatDate(todayISO())}
        </Pill>
      </div>
    </div>
  );
}
