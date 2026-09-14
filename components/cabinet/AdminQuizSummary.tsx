'use client';

import { useEffect, useState } from 'react';
import * as api from '@/lib/api';
import { Icon } from './icons';
import { CardTitle, EmptyState, Pill, SectionHeader, StatTile } from './ui';

// Сводка по тестам: как водители сдают инструктаж и в каких разделах
// регламента ошибаются чаще всего.
//
// Считается из сохранённых ответов, а не только из баллов: по ним видно не
// «сдал / не сдал», а что именно людям стоит объяснить ещё раз.

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export default function AdminQuizSummary() {
  const [summary, setSummary] = useState<api.QuizSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.quiz
      .summary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить сводку.'));
  }, []);

  if (error) return <p className="px-1 py-6 text-center text-sm text-[#c0564a]">{error}</p>;
  if (!summary) return <p className="px-1 py-6 text-center text-sm text-[#9a9d96]">Загружаем сводку…</p>;

  const { totals, byDriver, byTopic, hardestQuestions } = summary;
  const passPercent = totals.attempts === 0 ? 0 : Math.round((totals.passed / totals.attempts) * 100);

  if (totals.attempts === 0) {
    return (
      <EmptyState
        icon="chart"
        title="Тесты ещё не проходили"
        hint="Как только водители начнут проходить инструктаж перед сменой, здесь появится статистика."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="clipboard" value={totals.attempts} label="Попыток всего" />
        <StatTile
          icon="check-circle"
          value={`${passPercent}%`}
          label="Сдано с первого раза"
          tone={passPercent < 70 ? 'warn' : undefined}
        />
      </div>

      <SectionHeader title={`По водителям · ${byDriver.length}`} />
      {byDriver.map((d) => (
        <div key={d.driverId} className="p-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{d.driverLabel}</p>
              <p className="text-xs text-[#9a9d96]">
                {d.attempts === 0 ? 'ещё не проходил' : `последний тест ${formatWhen(d.lastAt)}`}
              </p>
            </div>
            {d.attempts > 0 && (
              <Pill tone={d.failed === 0 ? 'good' : d.failed > d.passed ? 'bad' : 'warn'}>{d.lastScore}</Pill>
            )}
          </div>

          {d.attempts > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#e7e9e2] pt-3 text-center">
              <div>
                <p className="text-sm font-bold tabular-nums">{d.attempts}</p>
                <p className="p-eyebrow">попыток</p>
              </div>
              <div>
                <p className="text-sm font-bold tabular-nums text-[#c0564a]">{d.failed}</p>
                <p className="p-eyebrow">не сдано</p>
              </div>
              <div>
                <p className="text-sm font-bold tabular-nums">{d.averagePercent}%</p>
                <p className="p-eyebrow">верных</p>
              </div>
            </div>
          )}

          {d.attempts > 0 && (
            <p className="mt-2 text-[11px] text-[#9a9d96]">
              подписано ознакомлений: {d.signed} из {d.passed} сданных
            </p>
          )}
        </div>
      ))}

      {byTopic.length > 0 && (
        <>
          <SectionHeader title="По разделам регламента" hint="доля неверных ответов" />
          <div className="p-card p-4">
            <div className="flex flex-col">
              {byTopic.map((t) => (
                <div key={t.topic} className="p-card-line py-2.5 last:border-none">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.topic}</span>
                    <span
                      className={
                        'shrink-0 text-xs font-bold tabular-nums ' +
                        (t.errorPercent >= 40 ? 'text-[#c0564a]' : t.errorPercent >= 20 ? 'text-[#b5811c]' : 'text-[#5e9128]')
                      }
                    >
                      {t.errorPercent}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e9e2]">
                    <div
                      className={
                        'h-full rounded-full ' +
                        (t.errorPercent >= 40 ? 'bg-[#c0564a]' : t.errorPercent >= 20 ? 'bg-[#b5811c]' : 'bg-[#8fc640]')
                      }
                      style={{ width: `${Math.max(t.errorPercent, 2)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#9a9d96]">
                    {t.wrong} ошибок из {t.asked} ответов
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {hardestQuestions.length > 0 && (
        <div className="p-card p-4">
          <CardTitle icon="warning" title="Чаще всего ошибаются" />
          <div className="flex flex-col">
            {hardestQuestions.map((q) => (
              <div key={q.id} className="p-card-line py-2.5 last:border-none">
                <p className="text-sm leading-snug">{q.question}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9a9d96]">
                  <Icon name="x" size={11} className="text-[#c0564a]" />
                  {q.wrong} из {q.asked}
                  {q.topic && ` · ${q.topic}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
