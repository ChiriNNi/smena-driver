'use client';

import { useState } from 'react';
import { formatDate, initials, uid, type QuizQuestion } from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, Field, IconButton, Pill, SectionHeader, Sheet, StatTile } from './ui';

// Тест по ТБ: вопросы с вариантами и правильным ответом + журнал ознакомления.
// Проверка ответов в проде остаётся на сервере — на клиент правильные ответы
// не отдаются, здесь они видны только администратору.

const EMPTY = { question: '', options: ['', '', ''], correct: 0 };

export default function AdminQuiz() {
  const { quiz, acks, drivers, addQuestion, updateQuestion, removeQuestion } = useStore();
  const [editing, setEditing] = useState<QuizQuestion | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuizQuestion | null>(null);
  const [form, setForm] = useState<{ question: string; options: string[]; correct: number }>(EMPTY);

  const activeDrivers = drivers.filter((d) => d.role === 'driver');
  const passed = activeDrivers.filter((d) => acks.some((a) => a.driverId === d.id)).length;

  function openNew() {
    setForm({ ...EMPTY, options: ['', '', ''] });
    setEditing('new');
  }

  function openEdit(q: QuizQuestion) {
    setForm({ question: q.question, options: [...q.options], correct: q.correct });
    setEditing(q);
  }

  const filledOptions = form.options.map((o) => o.trim()).filter(Boolean);
  const canSave = form.question.trim() && filledOptions.length >= 2 && form.options[form.correct]?.trim();

  function save() {
    if (!canSave) return;
    // Пустые варианты выкидываем, индекс правильного пересчитываем на новый список.
    const correctText = form.options[form.correct];
    const options = form.options.map((o) => o.trim()).filter(Boolean);
    const correct = Math.max(0, options.indexOf(correctText.trim()));
    if (editing === 'new') {
      addQuestion({ id: uid('q'), question: form.question.trim(), options, correct });
    } else if (editing) {
      updateQuestion(editing.id, { question: form.question.trim(), options, correct });
    }
    setEditing(null);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="shield" value={quiz.length} label="Вопросов в тесте" />
        <StatTile
          icon="users"
          value={`${passed}/${activeDrivers.length}`}
          label="Прошли тест"
          tone={passed < activeDrivers.length ? 'warn' : undefined}
        />
      </div>

      <SectionHeader
        title={`Вопросы · ${quiz.length}`}
        action={
          <button onClick={openNew} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Добавить
          </button>
        }
      />

      {quiz.length === 0 ? (
        <EmptyState icon="shield" title="Вопросов нет" hint="Добавьте вопросы — без пройденного теста водитель не начнёт смену." />
      ) : (
        <div className="flex flex-col gap-2">
          {quiz.map((q, i) => (
            <div key={q.id} className="p-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold tabular-nums text-[#5e9128] ring-1 ring-inset ring-[#e7e9e2]">
                  {i + 1}
                </div>
                <p className="min-w-0 flex-1 text-sm font-semibold">{q.question}</p>
                <IconButton icon="pencil" label="Изменить" onClick={() => openEdit(q)} />
                <IconButton icon="trash" label="Удалить" tone="danger" onClick={() => setConfirmDelete(q)} />
              </div>
              <div className="mt-2 ml-11 flex flex-col gap-1">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={
                      'flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs ' +
                      (oi === q.correct ? 'bg-[#8fc640]/15 font-semibold text-[#5e9128]' : 'text-[#5c6066]')
                    }
                  >
                    {oi === q.correct ? <Icon name="check" size={13} className="shrink-0" /> : <span className="w-[13px] shrink-0" />}
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="Журнал ознакомления" />
      <div className="p-card p-4">
        <div className="flex flex-col">
          {activeDrivers.map((d) => {
            const ack = acks.filter((a) => a.driverId === d.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
            return (
              <div key={d.id} className="p-card-line flex items-center gap-3 py-2.5 last:border-none">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-[11px] font-bold text-[#5e9128]">
                  {initials(d)}
                </div>
                <p className="min-w-0 flex-1 truncate text-sm">
                  {d.lastName} {d.firstName}
                </p>
                {ack ? (
                  <Pill tone={ack.score === ack.total ? 'good' : 'warn'}>
                    {ack.score}/{ack.total} · {formatDate(ack.date)}
                  </Pill>
                ) : (
                  <Pill tone="bad">не пройден</Pill>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <Sheet
          icon="shield"
          title={editing === 'new' ? 'Новый вопрос' : 'Изменить вопрос'}
          subtitle="Отметьте галочкой правильный вариант"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={save} disabled={!canSave} className="p-btn p-btn-primary flex-1 py-3 text-xs">
                Сохранить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field
              label="Вопрос"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="Максимальная скорость в городе?"
            />

            <div>
              <label className="p-eyebrow mb-1.5 block">Варианты ответа</label>
              <div className="flex flex-col gap-2">
                {form.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      onClick={() => setForm((f) => ({ ...f, correct: oi }))}
                      aria-label="Правильный ответ"
                      className={
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ' +
                        (form.correct === oi ? 'border-[#8fc640] bg-[#8fc640] text-white' : 'border-[#d7dacf] bg-white text-transparent')
                      }
                    >
                      <Icon name="check" size={14} />
                    </button>
                    <input
                      className="p-input text-sm"
                      value={opt}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, options: f.options.map((o, i) => (i === oi ? e.target.value : o)) }))
                      }
                      placeholder={`Вариант ${oi + 1}`}
                    />
                    {form.options.length > 2 && (
                      <IconButton
                        icon="trash"
                        label="Убрать вариант"
                        tone="danger"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            options: f.options.filter((_, i) => i !== oi),
                            correct: f.correct > oi ? f.correct - 1 : Math.min(f.correct, f.options.length - 2),
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
              {form.options.length < 5 && (
                <button
                  onClick={() => setForm((f) => ({ ...f, options: [...f.options, ''] }))}
                  className="p-btn p-btn-outline mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-xs"
                >
                  <Icon name="plus" size={14} />
                  Ещё вариант
                </button>
              )}
            </div>
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить вопрос?"
          message={`«${confirmDelete.question}» исчезнет из теста.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeQuestion(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}
