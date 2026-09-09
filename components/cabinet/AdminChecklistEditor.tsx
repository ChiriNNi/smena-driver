'use client';

import { useState } from 'react';
import { countTemplateItems, type PhaseId, type TemplateItem, type TemplatePhase, type TemplateSection } from '@/lib/model';
import { useStore } from './store';
import { Icon, phaseIconName, sectionIconName } from './icons';
import { ConfirmDialog, Field, IconButton, Pill, SectionHeader, SegmentedTabs, Sheet, StatTile } from './ui';

// Редактор чек-листа: правка текста и нормы пункта, порядок, секции и флаг
// «замечание с фото». Правки видит водитель в своей смене сразу.

type Target =
  | { kind: 'section'; sectionId: string }
  | { kind: 'item'; sectionId: string; index: number };

export default function AdminChecklistEditor() {
  const { checklist, saveChecklist } = useStore();
  const [phaseId, setPhaseId] = useState<PhaseId>('start');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Target | 'new-section' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Target | null>(null);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ title: '', qty: '', notable: false });

  const phaseIdx = checklist.findIndex((p) => p.id === phaseId);
  const phase = checklist[phaseIdx];

  /**
   * Правка уходит на сервер целиком: он присылает обратно шаблон с настоящими
   * id новых пунктов. Пункт, удалённый здесь, в базе помечается неактивным —
   * сданные смены, где он был отмечен, остаются целыми.
   */
  function update(mutate: (draft: TemplatePhase[]) => void) {
    const next = JSON.parse(JSON.stringify(checklist)) as TemplatePhase[];
    mutate(next);
    setSaving(true);
    void saveChecklist(next).finally(() => setSaving(false));
  }

  function sectionOf(draft: TemplatePhase[], sectionId: string): TemplateSection {
    return draft[phaseIdx].sections.find((s) => s.id === sectionId)!;
  }

  /** Временный id до сохранения: сервер отличает его от настоящего и создаёт запись. */
  function tempId(): string {
    return `new_${Math.random().toString(36).slice(2, 9)}`;
  }

  /* ─── Пункты ───────────────────────────────────────────────────────────── */

  function addItem(sectionId: string) {
    const text = (newItemText[sectionId] ?? '').trim();
    if (!text) return;
    update((draft) => sectionOf(draft, sectionId).items.push({ id: tempId(), text }));
    setNewItemText((m) => ({ ...m, [sectionId]: '' }));
  }

  function moveItem(sectionId: string, index: number, dir: -1 | 1) {
    update((draft) => {
      const items = sectionOf(draft, sectionId).items;
      const target = index + dir;
      if (target < 0 || target >= items.length) return;
      [items[index], items[target]] = [items[target], items[index]];
    });
  }

  /* ─── Редактирование через шторку ──────────────────────────────────────── */

  function openEdit(target: Target) {
    if (target.kind === 'section') {
      const section = phase.sections.find((s) => s.id === target.sectionId)!;
      setForm({ title: section.title, qty: '', notable: !!section.notable });
    } else {
      const item = phase.sections.find((s) => s.id === target.sectionId)!.items[target.index];
      setForm({ title: item.text, qty: item.qty ?? '', notable: false });
    }
    setEditing(target);
  }

  function openNewSection() {
    setForm({ title: '', qty: '', notable: false });
    setEditing('new-section');
  }

  function saveForm() {
    if (!form.title.trim()) return;
    if (editing === 'new-section') {
      update((draft) =>
        draft[phaseIdx].sections.push({
          id: tempId(),
          // slug пустой: иконку по нему не подобрать, поэтому у своего раздела
          // будет иконка по умолчанию (см. sectionIconName).
          slug: '',
          title: form.title.trim(),
          notable: form.notable,
          items: [],
        })
      );
    } else if (editing && editing.kind === 'section') {
      update((draft) => {
        const section = sectionOf(draft, editing.sectionId);
        section.title = form.title.trim();
        section.notable = form.notable;
      });
    } else if (editing && editing.kind === 'item') {
      update((draft) => {
        const item: TemplateItem = sectionOf(draft, editing.sectionId).items[editing.index];
        item.text = form.title.trim();
        if (form.qty.trim()) item.qty = form.qty.trim();
        else delete item.qty;
      });
    }
    setEditing(null);
  }

  function doDelete(target: Target) {
    update((draft) => {
      if (target.kind === 'section') {
        draft[phaseIdx].sections = draft[phaseIdx].sections.filter((s) => s.id !== target.sectionId);
      } else {
        sectionOf(draft, target.sectionId).items.splice(target.index, 1);
      }
    });
    setConfirmDelete(null);
  }

  const sheetTitle =
    editing === 'new-section' ? 'Новая секция' : editing?.kind === 'section' ? 'Изменить секцию' : 'Изменить пункт';

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="clipboard" value={countTemplateItems(checklist)} label="Пунктов всего" />
        <StatTile icon="box" value={phase?.sections.length ?? 0} label="Секций в фазе" />
      </div>

      <SegmentedTabs<PhaseId>
        items={checklist.map((p) => ({ id: p.id, label: p.phase }))}
        active={phaseId}
        onChange={setPhaseId}
      />

      <SectionHeader
        title={`${phase?.phase ?? ''} · ${phase?.sections.reduce((s, x) => s + x.items.length, 0) ?? 0} пунктов`}
        hint={saving ? 'сохраняем…' : 'правки сразу видны водителям'}
        action={
          <button onClick={openNewSection} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Секция
          </button>
        }
      />

      {phase?.sections.map((section) => (
        <div key={section.id} className="p-card p-4">
          <div className="mb-1 flex items-center gap-2">
            <Icon name={sectionIconName(section.slug)} size={16} className="shrink-0 text-[#8fc640]" />
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold">{section.title}</h3>
            {section.notable && <Pill tone="warn">фото</Pill>}
            <IconButton icon="pencil" label="Изменить секцию" onClick={() => openEdit({ kind: 'section', sectionId: section.id })} />
            <IconButton
              icon="trash"
              label="Удалить секцию"
              tone="danger"
              onClick={() => setConfirmDelete({ kind: 'section', sectionId: section.id })}
            />
          </div>

          <div className="flex flex-col">
            {section.items.map((item, idx) => (
              <div key={idx} className="p-card-line flex items-center gap-1 py-1.5 last:border-none">
                <button
                  onClick={() => openEdit({ kind: 'item', sectionId: section.id, index: idx })}
                  className="flex min-h-10 min-w-0 flex-1 items-center py-1 text-left"
                >
                  <span className="text-sm">{item.text}</span>
                  {item.qty && <span className="ml-2 text-xs font-semibold text-[#9a9d96]">{item.qty}</span>}
                </button>
                <IconButton icon="chevron-up" label="Выше" disabled={idx === 0} onClick={() => moveItem(section.id, idx, -1)} />
                <IconButton
                  icon="chevron-down"
                  label="Ниже"
                  disabled={idx === section.items.length - 1}
                  onClick={() => moveItem(section.id, idx, 1)}
                />
                <IconButton
                  icon="trash"
                  label="Удалить пункт"
                  tone="danger"
                  onClick={() => setConfirmDelete({ kind: 'item', sectionId: section.id, index: idx })}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={newItemText[section.id] ?? ''}
              onChange={(e) => setNewItemText((m) => ({ ...m, [section.id]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addItem(section.id)}
              placeholder="Новый пункт..."
              className="p-input text-sm"
            />
            <button onClick={() => addItem(section.id)} className="p-btn p-btn-outline flex items-center justify-center px-4">
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
      ))}

      {phase?.sections.length === 0 && (
        <div className="p-card px-5 py-8 text-center">
          <p className="text-sm font-semibold">В этой фазе нет секций</p>
          <p className="mt-1 text-xs text-[#9a9d96]">Добавьте секцию — например «Приём кассы».</p>
        </div>
      )}

      {editing && (
        <Sheet
          icon={editing === 'new-section' || editing.kind === 'section' ? 'box' : 'check-circle'}
          title={sheetTitle}
          subtitle={phase?.phase}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={saveForm} disabled={!form.title.trim()} className="p-btn p-btn-primary flex-1 py-3 text-xs">
                Сохранить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field
              label={editing !== 'new-section' && editing.kind === 'item' ? 'Текст пункта' : 'Название секции'}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={editing !== 'new-section' && editing.kind === 'item' ? 'Чистая обувь' : 'Приём кассы'}
            />

            {editing !== 'new-section' && editing.kind === 'item' && (
              <Field
                label="Норма"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                placeholder="3 шт."
                hint="Показывается справа от пункта. Оставьте пустым, если норма не нужна."
              />
            )}

            {(editing === 'new-section' || editing.kind === 'section') && (
              <button
                onClick={() => setForm((f) => ({ ...f, notable: !f.notable }))}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-inset ring-[#e7e9e2]"
              >
                <span
                  className={
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ' +
                    (form.notable ? 'border-[#8fc640] bg-[#8fc640] text-white' : 'border-[#d7dacf] bg-white text-transparent')
                  }
                >
                  <Icon name="check" size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Разрешить замечания с фото</span>
                  <span className="block text-xs leading-relaxed text-[#9a9d96]">
                    У пунктов секции появится кнопка «Замечание» — комментарий и снимки с камеры.
                  </span>
                </span>
              </button>
            )}
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.kind === 'section' ? 'Удалить секцию?' : 'Удалить пункт?'}
          message={
            confirmDelete.kind === 'section'
              ? `Секция «${phase.sections.find((s) => s.id === confirmDelete.sectionId)?.title}» и все её пункты исчезнут из чек-листа. В прошлых сменах данные останутся.`
              : 'Пункт исчезнет из чек-листа новых смен. В прошлых сменах данные останутся.'
          }
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => doDelete(confirmDelete)}
        />
      )}

      <div className="rounded-2xl border border-dashed border-[#e7e9e2] bg-[#f5f6f1] p-3.5 text-xs leading-relaxed text-[#5c6066]">
        <Icon name={phaseIconName(phaseId)} size={14} className="mr-1 inline text-[#8fc640]" />
        Правки применяются к новым сменам. Уже закрытые смены сохраняют тот набор пунктов, который был на момент их
        завершения — история не переписывается.
      </div>
    </>
  );
}
