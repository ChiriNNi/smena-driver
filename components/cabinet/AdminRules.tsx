'use client';

import { useState } from 'react';
import type { Rule } from '@/lib/model';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, Field, IconButton, SectionHeader, Sheet, TextField } from './ui';

// Правила и инструктаж по ТБ: администратор ведёт свод правил, водитель
// читает его перед тестом.

export default function AdminRules() {
  const { rules, addRule, updateRule, removeRule } = useStore();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Rule | null>(null);
  const [form, setForm] = useState({ title: '', body: '' });

  function openNew() {
    setForm({ title: '', body: '' });
    setEditing('new');
  }

  function openEdit(rule: Rule) {
    setForm({ title: rule.title, body: rule.body });
    setEditing(rule);
  }

  function save() {
    if (!form.title.trim()) return;
    if (editing === 'new') {
      void addRule({ title: form.title.trim(), body: form.body.trim() });
    } else if (editing) {
      void updateRule(editing.id, { title: form.title.trim(), body: form.body.trim() });
    }
    setEditing(null);
  }

  return (
    <>
      <SectionHeader
        title={`Правила · ${rules.length}`}
        action={
          <button onClick={openNew} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Добавить
          </button>
        }
      />

      {rules.length === 0 ? (
        <EmptyState icon="shield" title="Правил нет" hint="Опишите правила — водитель увидит их перед прохождением теста по ТБ." />
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule, i) => (
            <div key={rule.id} className="p-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold tabular-nums text-[#5e9128] ring-1 ring-inset ring-[#e7e9e2]">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{rule.title}</p>
                  {rule.body && <p className="mt-1 text-xs leading-relaxed text-[#5c6066]">{rule.body}</p>}
                </div>
                <IconButton icon="pencil" label="Изменить" onClick={() => openEdit(rule)} />
                <IconButton icon="trash" label="Удалить" tone="danger" onClick={() => setConfirmDelete(rule)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Sheet
          icon="shield"
          title={editing === 'new' ? 'Новое правило' : 'Изменить правило'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={save} disabled={!form.title.trim()} className="p-btn p-btn-primary flex-1 py-3 text-xs">
                Сохранить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label="Заголовок" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Скоростной режим" />
            <TextField
              label="Текст правила"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="В городе не превышать 60 км/ч..."
            />
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить правило?"
          message={`«${confirmDelete.title}» исчезнет из инструктажа.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeRule(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}
