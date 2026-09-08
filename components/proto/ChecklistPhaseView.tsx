'use client';

import { useRef, type ReactNode } from 'react';
import type { ChecklistPhase } from '@/lib/checklist-data';
import { itemKey } from '@/lib/checklist-data';
import type { NoteEntry } from '@/lib/proto-data';
import { Icon, sectionIconName } from './icons';

type Props = {
  phase: ChecklistPhase;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
  notes: Record<string, NoteEntry>;
  openNoteKey: string | null;
  onOpenNote: (key: string | null) => void;
  onNoteChange: (key: string, entry: NoteEntry) => void;
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
};

export default function ChecklistPhaseView({ phase, checked, onToggle, notes, openNoteKey, onOpenNote, onNoteChange, headerExtra, footerExtra }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function attachPhoto(key: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const current = notes[key] ?? { comment: '', photos: [] };
    const urls = Array.from(files).slice(0, 5 - current.photos.length).map((f) => URL.createObjectURL(f));
    onNoteChange(key, { ...current, photos: [...current.photos, ...urls] });
  }

  return (
    <div className="w-full shrink-0 snap-start px-4 pb-6 pt-4">
      <div className="flex flex-col gap-4">
        {headerExtra}
        {phase.sections.map((section) => (
          <div key={section.id} className="p-card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Icon name={sectionIconName(section.id)} size={17} className="text-[#8fc640]" />{section.title}
            </h3>
            <div className="flex flex-col">
              {section.items.map((item, idx) => {
                const key = itemKey(phase.id, section.id, idx);
                const isChecked = !!checked[key];
                const note = notes[key];
                const noteOpen = openNoteKey === key;
                const hasNote = !!note && (note.comment.trim() || note.photos.length > 0);
                return (
                  <div key={key} className="p-card-line last:border-none">
                    <div className="flex min-h-11 items-center gap-2">
                      <button
                        onClick={() => onToggle(key)}
                        className="flex min-h-11 flex-1 items-center gap-3 py-2.5 text-left active:opacity-70"
                        aria-label="Отметить пункт"
                      >
                        <span
                          className={
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ' +
                            (isChecked ? 'border-[#8fc640] bg-[#8fc640] text-white' : 'border-[#d7dacf] bg-white text-transparent')
                          }
                        >
                          <Icon name="check" size={13} />
                        </span>
                        <span className="flex flex-1 items-center justify-between gap-3">
                          <p className={'text-sm leading-snug ' + (isChecked ? 'text-[#9a9d96] line-through decoration-[#d7dacf]' : 'text-[#1a1d1e]')}>
                            {item.text}
                          </p>
                          {item.qty && (
                            <span className="shrink-0 rounded-full bg-[#f0f1ec] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#5c6066]">
                              {item.qty}
                            </span>
                          )}
                        </span>
                      </button>
                      {section.notable && (
                        <button
                          onClick={() => onOpenNote(noteOpen ? null : key)}
                          className={
                            'p-btn flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px] ' +
                            (hasNote ? 'bg-[#8fc640]/15 text-[#5e9128]' : 'bg-white text-[#9a9d96] ring-1 ring-inset ring-[#e7e9e2] hover:text-[#5c6066]')
                          }
                        >
                          <Icon name={hasNote ? 'camera' : 'warning'} size={13} />
                          {hasNote ? note!.photos.length : 'Замечание'}
                        </button>
                      )}
                    </div>

                    {section.notable && noteOpen && (
                      <div className="p-fade-up mb-3 ml-9 rounded-2xl bg-white p-3 ring-1 ring-inset ring-[#e7e9e2]">
                        <p className="mb-2 text-xs text-[#9a9d96]">Необязательно — заполняйте, только если есть повреждение или замечание</p>
                        <textarea
                          value={note?.comment ?? ''}
                          onChange={(e) => onNoteChange(key, { comment: e.target.value, photos: note?.photos ?? [] })}
                          placeholder="Например: скол на переднем бампере справа"
                          rows={2}
                          className="p-input resize-none text-sm"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {(note?.photos ?? []).map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={src} alt="" className="h-14 w-14 rounded-xl object-cover" />
                          ))}
                          <button
                            onClick={() => {
                              fileInputRef.current?.setAttribute('data-key', key);
                              fileInputRef.current?.click();
                            }}
                            className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[#d7dacf] text-[#9a9d96] transition hover:border-[#8fc640] hover:text-[#8fc640]"
                          >
                            <Icon name="plus" size={18} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {footerExtra}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const key = fileInputRef.current?.getAttribute('data-key');
          if (key) attachPhoto(key, e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
