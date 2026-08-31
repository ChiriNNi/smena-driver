'use client';

import { useEffect, useState } from 'react';
import { DUTIES, RULES } from '@/lib/duties-rules-data';
import { apiGet, apiSend } from '@/lib/client-api';

type QuizQ = { q: string; options: string[] };

export default function Rules() {
  const [sub, setSub] = useState<'duties' | 'rules'>('duties');
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['duties', 'rules'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${sub === s ? 'bg-amber-500 text-neutral-950' : 'border border-neutral-700 text-neutral-400'}`}
          >
            {s === 'duties' ? 'Обязанности' : 'Правила и тест'}
          </button>
        ))}
      </div>
      {sub === 'duties' ? <Duties /> : <RulesAndQuiz />}
    </div>
  );
}

function Duties() {
  return (
    <div className="flex flex-col gap-4">
      {DUTIES.map((d) => (
        <div key={d.cat} className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{d.icon} {d.cat}</h3>
          {d.groups.map((g) => (
            <div key={g.freq} className="mb-3 last:mb-0">
              <p className="mb-1 text-xs font-medium text-amber-400">{g.freq}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
                {g.items.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RulesAndQuiz() {
  const [quiz, setQuiz] = useState<QuizQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; saved: boolean } | null>(null);
  const [name, setName] = useState('');
  const [signMsg, setSignMsg] = useState('');

  useEffect(() => { apiGet<{ quiz: QuizQ[] }>('/api/rules/quiz').then((d) => setQuiz(d.quiz)); }, []);

  function currentAnswers(): number[] | null {
    const arr = quiz.map((_, i) => answers[i] ?? -1);
    if (arr.some((a) => a === -1)) { alert('Ответьте на все вопросы.'); return null; }
    return arr;
  }

  async function checkQuiz() {
    const arr = currentAnswers();
    if (!arr) return;
    const r = await apiSend<{ score: number; total: number; passed: boolean }>('/api/rules/check', 'POST', { answers: arr });
    setResult({ ...r, saved: false });
  }

  async function submitQuiz() {
    if (!name.trim()) { alert('Укажите ФИО.'); return; }
    const arr = currentAnswers();
    if (!arr) return;
    const r = await apiSend<{ score: number; total: number; passed: boolean; saved: boolean }>('/api/rules/ack', 'POST', { answers: arr, driverName: name.trim() });
    setResult(r);
    if (r.saved) setSignMsg(`Подпись сохранена: ${name}, результат ${r.score}/${r.total}.`);
  }

  return (
    <div className="flex flex-col gap-4">
      {RULES.map((r) => (
        <div key={r.title} className="card p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">{r.icon} {r.title}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
            {r.points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      ))}

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold">Тест на знание правил (8 из 10 для прохождения)</h3>
        <div className="flex flex-col gap-4">
          {quiz.map((q, qi) => (
            <div key={qi}>
              <p className="mb-2 text-sm text-neutral-200">{qi + 1}. {q.q}</p>
              <div className="flex flex-col gap-1">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 text-sm text-neutral-300">
                    <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {quiz.length > 0 && (
          <button onClick={checkQuiz} className="btn-outline mt-4 w-full">
            Проверить тест
          </button>
        )}
        {result && (
          <p className={`mt-2 text-sm ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            Результат: {result.score}/{result.total} — {result.passed ? 'тест пройден' : 'не пройден, попробуйте ещё раз'}
          </p>
        )}
        {result?.passed && (
          <div className="mt-4 border-t border-neutral-800 pt-4">
            <label className="label">ФИО для подписи об ознакомлении</label>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Иванов Иван Иванович" />
              <button onClick={submitQuiz} className="btn-gold px-4">Подписать</button>
            </div>
            {signMsg && <p className="mt-2 text-sm text-emerald-400">{signMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
