'use client';

import { useRef, useState, type ReactNode } from 'react';
import * as api from '@/lib/api';
import { compressImageToFile } from '@/lib/compress-image';
import type { NoteEntry } from '@/lib/labels';
import type { TemplatePhase } from '@/lib/model';
import { Icon, sectionIconName } from './icons';

type Props = {
  phase: TemplatePhase;
  checked: Record<string, boolean>;
  onToggle: (itemId: string) => void;
  notes: Record<string, NoteEntry>;
  openNoteKey: string | null;
  onOpenNote: (itemId: string | null) => void;
  onNoteChange: (itemId: string, entry: NoteEntry) => void;
  /** Загрузка фото включена, только если на сервере настроено хранилище. */
  photoUploadEnabled: boolean;
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
};

const MAX_PHOTOS = 5;

export default function ChecklistPhaseView({
  phase,
  checked,
  onToggle,
  notes,
  openNoteKey,
  onOpenNote,
  onNoteChange,
  photoUploadEnabled,
  headerExtra,
  footerExtra,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

  /**
   * Фото уходит в хранилище сразу, не дожидаясь конца смены: если приложение
   * закроется, снимок повреждения не потеряется, а в черновике останется
   * только путь к файлу.
   */
  async function attachPhotos(itemId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const current = notes[itemId] ?? { comment: '', photos: [] };
    const room = MAX_PHOTOS - current.photos.length;
    if (room <= 0) return;

    setUploading(itemId);
    setUploadError('');
    const added = [...current.photos];

    for (const file of Array.from(files).slice(0, room)) {
      try {
        const compressed = await compressImageToFile(file);
        const { path, url } = await api.photos.upload(compressed);
        added.push({ path, url: url ?? '' });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Не удалось загрузить фото.');
        break;
      }
    }

    onNoteChange(itemId, { ...current, photos: added });
    setUploading(null);
  }

  async function removePhoto(itemId: string, path: string) {
    const current = notes[itemId];
    if (!current) return;
    onNoteChange(itemId, { ...current, photos: current.photos.filter((p) => p.path !== path) });
    // Файл в хранилище удаляем следом; если запрос не дойдёт, останется
    // «сирота» в бакете — на смену это не влияет.
    await api.photos.remove(path).catch(() => {});
  }

  return (
    <div className="w-full shrink-0 snap-start px-4 pb-6 pt-4">
      <div className="flex flex-col gap-4">
        {headerExtra}
        {phase.sections.map((section) => (
          <div key={section.id} className="p-card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Icon name={sectionIconName(section.slug)} size={17} className="text-[#8fc640]" />
              {section.title}
            </h3>
            <div className="flex flex-col">
              {section.items.map((item) => {
                const isChecked = !!checked[item.id];
                const note = notes[item.id];
                const noteOpen = openNoteKey === item.id;
                const hasNote = !!note && (note.comment.trim() !== '' || note.photos.length > 0);
                return (
                  <div key={item.id} className="p-card-line last:border-none">
                    <div className="flex min-h-11 items-center gap-2">
                      <button
                        onClick={() => onToggle(item.id)}
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
                          <p
                            className={
                              'text-sm leading-snug ' +
                              (isChecked ? 'text-[#9a9d96] line-through decoration-[#d7dacf]' : 'text-[#1a1d1e]')
                            }
                          >
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
                          onClick={() => onOpenNote(noteOpen ? null : item.id)}
                          className={
                            'p-btn flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px] ' +
                            (hasNote
                              ? 'bg-[#8fc640]/15 text-[#5e9128]'
                              : 'bg-white text-[#9a9d96] ring-1 ring-inset ring-[#e7e9e2] hover:text-[#5c6066]')
                          }
                        >
                          <Icon name={hasNote ? 'camera' : 'warning'} size={13} />
                          {hasNote ? note!.photos.length || '✓' : 'Замечание'}
                        </button>
                      )}
                    </div>

                    {section.notable && noteOpen && (
                      <div className="p-fade-up mb-3 ml-9 rounded-2xl bg-white p-3 ring-1 ring-inset ring-[#e7e9e2]">
                        <p className="mb-2 text-xs text-[#9a9d96]">
                          Необязательно — заполняйте, только если есть повреждение или замечание
                        </p>
                        <textarea
                          value={note?.comment ?? ''}
                          onChange={(e) => onNoteChange(item.id, { comment: e.target.value, photos: note?.photos ?? [] })}
                          placeholder="Например: скол на переднем бампере справа"
                          rows={2}
                          className="p-input resize-none text-sm"
                        />

                        {photoUploadEnabled && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {(note?.photos ?? []).map((photo) => (
                              <div key={photo.path} className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element -- временная подписанная ссылка на файл в приватном бакете */}
                                <img src={photo.url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                                <button
                                  onClick={() => void removePhoto(item.id, photo.path)}
                                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1d1e] text-white"
                                  aria-label="Удалить фото"
                                >
                                  <Icon name="x" size={11} />
                                </button>
                              </div>
                            ))}

                            {(note?.photos.length ?? 0) < MAX_PHOTOS && (
                              <button
                                disabled={uploading === item.id}
                                onClick={() => {
                                  fileInputRef.current?.setAttribute('data-item', item.id);
                                  fileInputRef.current?.click();
                                }}
                                className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[#d7dacf] text-[#9a9d96] transition hover:border-[#8fc640] hover:text-[#8fc640] disabled:opacity-50"
                                aria-label="Добавить фото"
                              >
                                {uploading === item.id ? (
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d7dacf] border-t-[#8fc640]" />
                                ) : (
                                  <Icon name="camera" size={18} />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {uploadError && <p className="mt-2 text-xs text-[#c0564a]">{uploadError}</p>}
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

      {/* capture="environment" открывает камеру сразу, без выбора «Камера или Галерея» */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const itemId = fileInputRef.current?.getAttribute('data-item');
          if (itemId) void attachPhotos(itemId, e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
