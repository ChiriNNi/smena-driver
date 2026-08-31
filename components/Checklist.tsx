'use client';

import { useState } from 'react';
import { CHECKLIST, itemKey } from '@/lib/checklist-data';
import type { NoteEntry } from '@/lib/types';
import { compressImageToDataURL } from '@/lib/compress-image';

type Props = {
  phaseId: 'start' | 'process' | 'end';
  checked: Record<string, boolean>;
  notes: Record<string, NoteEntry>;
  onToggle: (key: string) => void;
  onNoteChange: (key: string, text: string) => void;
  onAddPhoto: (key: string, dataUrl: string) => void;
  onDeletePhoto: (key: string, idx: number) => void;
};

export default function Checklist({ phaseId, checked, notes, onToggle, onNoteChange, onAddPhoto, onDeletePhoto }: Props) {
  const phase = CHECKLIST.find((p) => p.id === phaseId)!;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(phase.sections.map((s) => [s.id, true]))
  );
  const [openNote, setOpenNote] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      {phase.sections.map((section) => {
        const keys = section.items.map((_, i) => itemKey(phaseId, section.id, i));
        const done = keys.filter((k) => checked[k]).length;
        const allDone = done === keys.length;
        return (
          <section key={section.id} className={`card overflow-hidden ${allDone ? 'border-emerald-700/50' : ''}`}>
            <button
              onClick={() => setOpenSections((s) => ({ ...s, [section.id]: !s[section.id] }))}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                <span>{section.icon}</span> {section.title}
              </span>
              <span className={`text-xs ${allDone ? 'text-emerald-400' : 'text-neutral-500'}`}>{done}/{keys.length}</span>
            </button>
            {openSections[section.id] && (
              <div className="divide-y divide-neutral-800 border-t border-neutral-800">
                {section.items.map((item, i) => {
                  const key = itemKey(phaseId, section.id, i);
                  const isChecked = !!checked[key];
                  const note = notes[key];
                  return (
                    <div key={key} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onToggle(key)}
                          className={
                            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border text-xs transition ' +
                            (isChecked ? 'border-emerald-500 bg-emerald-500 text-neutral-950' : 'border-neutral-600 text-transparent hover:border-neutral-400')
                          }
                          aria-pressed={isChecked}
                        >
                          ✓
                        </button>
                        <button onClick={() => onToggle(key)} className="flex-1 text-left text-sm text-neutral-200">
                          {item.text}
                          {item.qty && <span className="ml-2 text-xs text-neutral-500">{item.qty}</span>}
                        </button>
                        {section.notable && (
                          <button
                            onClick={() => setOpenNote((s) => ({ ...s, [key]: !s[key] }))}
                            className="flex-shrink-0 text-neutral-500 hover:text-amber-400"
                            title="Заметка и фото"
                          >
                            📎{note?.photos?.length ? ` ${note.photos.length}` : ''}
                          </button>
                        )}
                      </div>
                      {section.notable && openNote[key] && (
                        <NoteEditor
                          note={note}
                          onTextChange={(t) => onNoteChange(key, t)}
                          onAddPhoto={async (file) => onAddPhoto(key, await compressImageToDataURL(file))}
                          onDeletePhoto={(idx) => onDeletePhoto(key, idx)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function NoteEditor({
  note, onTextChange, onAddPhoto, onDeletePhoto,
}: {
  note?: NoteEntry;
  onTextChange: (t: string) => void;
  onAddPhoto: (file: File) => void;
  onDeletePhoto: (idx: number) => void;
}) {
  return (
    <div className="mt-3 ml-9 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
      <textarea
        value={note?.text || ''}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Заметка (например, зафиксировать царапину)…"
        rows={2}
        className="input resize-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(note?.photos || []).map((src, idx) => (
          <div key={idx} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- превью локально загруженного data URL, next/image здесь не применим */}
            <img src={src} alt="Фото заметки" className="h-16 w-16 rounded-md object-cover" />
            <button
              onClick={() => onDeletePhoto(idx)}
              className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white group-hover:flex"
            >
              ✕
            </button>
          </div>
        ))}
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-700 text-xl text-neutral-500 hover:border-amber-500 hover:text-amber-400">
          +
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddPhoto(f); e.target.value = ''; }}
          />
        </label>
      </div>
    </div>
  );
}
