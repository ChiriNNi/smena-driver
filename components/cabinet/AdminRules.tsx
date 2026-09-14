'use client';

import { useMemo, useState } from 'react';
import { RULE_KIND_TITLE, type Rule, type RuleKind } from '@/lib/model';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, Field, IconButton, SectionHeader, SegmentedTabs, Sheet, TextField } from './ui';

// Редактор регламентов: обязанности и правила. Блок — заголовок, необязательный
// подзаголовок (у обязанностей это частота) и список пунктов.
//
// Пункты правятся одним полем, по строке на пункт: так проще, чем добавлять и
// удалять поля по одному, а порядок виден целиком.

export default function AdminRules() {
  const { rules, addRule, updateRule, removeRule } = useStore();
  const [kind, setKind] = useState<RuleKind>('rule');
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Rule | null>(null);
  const [form, setForm] = useState({ title: '', subtitle: '', points: '' });

  const visible = useMemo(() => rules.filter((r) => r.kind === kind), [rules, kind]);

  function openNew() {
    setForm({ title: '', subtitle: '', points: '' });
    setEditing('new');
  }

  function openEdit(rule: Rule) {
    setForm({ title: rule.title, subtitle: rule.subtitle, points: rule.points.join('\n') });
    setEditing(rule);
  }

  function save() {
    const points = form.points
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!form.title.trim() || points.length === 0) return;

    const data = { kind, title: form.title.trim(), subtitle: form.subtitle.trim(), points };
    if (editing === 'new') void addRule(data);
    else if (editing) void updateRule(editing.id, data);
    setEditing(null);
  }

  const pointsCount = visible.reduce((sum, r) => sum + r.points.length, 0);

  return (
    <>
      <SegmentedTabs<RuleKind>
        items={[
          { id: 'rule', label: RULE_KIND_TITLE.rule },
          { id: 'duty', label: RULE_KIND_TITLE.duty },
        ]}
        active={kind}
        onChange={setKind}
      />

      <SectionHeader
        title={`${RULE_KIND_TITLE[kind]} · ${visible.length}`}
        hint={`${pointsCount} пунктов — водитель читает их перед тестом`}
        action={
          <button onClick={openNew} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Блок
          </button>
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="Блоков нет"
          hint="Добавьте раздел регламента — он появится у водителя и станет основой для вопросов теста."
        />
      ) : (
        visible.map((rule) => (
          <div key={rule.id} className="p-card p-4">
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold">{rule.title}</h3>
                {rule.subtitle && <p className="p-eyebrow mt-0.5 text-[#5e9128]">{rule.subtitle}</p>}
              </div>
              <IconButton icon="pencil" label="Изменить блок" onClick={() => openEdit(rule)} />
              <IconButton icon="trash" label="Удалить блок" tone="danger" onClick={() => setConfirmDelete(rule)} />
            </div>
            <ul className="flex flex-col gap-1.5">
              {rule.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7dacf]" />
                  <span className="min-w-0 flex-1 text-xs leading-relaxed text-[#5c6066]">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {editing && (
        <Sheet
          icon="clipboard"
          title={editing === 'new' ? 'Новый блок' : 'Изменить блок'}
          subtitle={RULE_KIND_TITLE[kind]}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={save} className="p-btn p-btn-primary flex-1 py-3 text-xs">
                Сохранить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field
              label="Заголовок"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={kind === 'duty' ? 'Основные обязанности' : 'Внешний вид и дресс-код'}
            />
            <Field
              label="Подзаголовок"
              value={form.subtitle}
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              placeholder={kind === 'duty' ? 'Ежедневно' : 'необязательно'}
              hint={kind === 'duty' ? 'Частота: «Ежедневно», «По потребности».' : undefined}
            />
            <TextField
              label="Пункты — по одному в строке"
              rows={8}
              value={form.points}
              onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
              placeholder={'Опрятный внешний вид в течение смены\nЧистая обувь'}
            />
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить блок?"
          message={`«${confirmDelete.title}» исчезнет из регламента у водителей. Уже сданные тесты это не затронет.`}
          onConfirm={() => {
            void removeRule(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
