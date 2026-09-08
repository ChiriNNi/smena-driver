'use client';

import { useState } from 'react';
import type { ChecklistPhase } from '@/lib/checklist-data';
import { Icon, phaseIconName, sectionIconName } from './icons';

type Props = { checklist: ChecklistPhase[]; onChange: (next: ChecklistPhase[]) => void };

export default function AdminChecklistEditor({ checklist, onChange }: Props) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const phase = checklist[phaseIdx];

  function update(mutate: (draft: ChecklistPhase[]) => void) {
    const next = JSON.parse(JSON.stringify(checklist)) as ChecklistPhase[];
    mutate(next);
    onChange(next);
  }

  function removeItem(sectionId: string, idx: number) {
    update((draft) => {
      draft[phaseIdx].sections.find((s) => s.id === sectionId)!.items.splice(idx, 1);
    });
  }

  function moveItem(sectionId: string, idx: number, dir: -1 | 1) {
    update((draft) => {
      const items = draft[phaseIdx].sections.find((s) => s.id === sectionId)!.items;
      const target = idx + dir;
      if (target < 0 || target >= items.length) return;
      [items[idx], items[target]] = [items[target], items[idx]];
    });
  }

  function addItem(sectionId: string) {
    const text = (newItemText[sectionId] ?? '').trim();
    if (!text) return;
    update((draft) => {
      draft[phaseIdx].sections.find((s) => s.id === sectionId)!.items.push({ text });
    });
    setNewItemText((m) => ({ ...m, [sectionId]: '' }));
  }

  function removeSection(sectionId: string) {
    update((draft) => {
      draft[phaseIdx].sections = draft[phaseIdx].sections.filter((s) => s.id !== sectionId);
    });
  }

  function addSection() {
    const title = prompt('Название новой секции:');
    if (!title?.trim()) return;
    update((draft) => {
      // icon не используется в прототипе — иконка секции подбирается по id через sectionIconName()
      draft[phaseIdx].sections.push({ id: `custom_${Date.now()}`, title: title.trim(), icon: '', items: [] });
    });
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {checklist.map((ph, i) => (
          <button
            key={ph.id}
            onClick={() => setPhaseIdx(i)}
            className={'p-btn flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-xs ' + (i === phaseIdx ? 'p-btn-primary' : 'bg-[#f5f6f1] text-[#5c6066]')}
          >
            <Icon name={phaseIconName(ph.id)} size={14} />{ph.phase}
          </button>
        ))}
      </div>

      {phase.sections.map((section) => (
        <div key={section.id} className="p-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold"><Icon name={sectionIconName(section.id)} size={16} className="text-[#8fc640]" /> {section.title}</h3>
            <button onClick={() => removeSection(section.id)} className="text-xs font-medium text-[#c0564a] hover:underline">Удалить секцию</button>
          </div>
          <div className="flex flex-col">
            {section.items.map((item, idx) => (
              <div key={idx} className="p-card-line flex items-center gap-2 py-2 last:border-none">
                <span className="flex-1 text-sm">{item.text}</span>
                <button onClick={() => moveItem(section.id, idx, -1)} disabled={idx === 0} className="flex h-7 w-7 items-center justify-center rounded-full text-[#9a9d96] transition hover:bg-white hover:text-[#1a1d1e] disabled:opacity-30"><Icon name="chevron-up" size={15} /></button>
                <button onClick={() => moveItem(section.id, idx, 1)} disabled={idx === section.items.length - 1} className="flex h-7 w-7 items-center justify-center rounded-full text-[#9a9d96] transition hover:bg-white hover:text-[#1a1d1e] disabled:opacity-30"><Icon name="chevron-down" size={15} /></button>
                <button onClick={() => removeItem(section.id, idx)} className="flex h-7 w-7 items-center justify-center rounded-full text-[#c0564a] transition hover:bg-[#c0564a]/10"><Icon name="x" size={14} /></button>
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
            <button onClick={() => addItem(section.id)} className="p-btn p-btn-outline flex items-center justify-center px-4"><Icon name="plus" size={16} /></button>
          </div>
        </div>
      ))}

      <button onClick={addSection} className="p-btn p-btn-outline flex items-center justify-center gap-1.5 py-3"><Icon name="plus" size={15} />Добавить секцию</button>
    </div>
  );
}
