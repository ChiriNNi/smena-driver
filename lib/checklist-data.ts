// Начальный чек-лист смены — тот же, что был в исходном shift-checklist.html.
//
// Содержание вынесено в lib/seed-data.json: оттуда его берёт и скрипт
// начального заполнения базы (scripts/seed.mjs), и прототип. Один источник,
// чтобы правки в тексте пунктов не приходилось вносить дважды.
//
// После наполнения базы рабочий чек-лист приходит из БД (см. app/api/checklist)
// и правится администратором в редакторе — этот файл остаётся только исходным
// набором для первого разворачивания.

import seed from './seed-data.json';

export type ChecklistItem = { text: string; qty?: string };
export type ChecklistSection = {
  /** Постоянный код раздела: по нему подбирается иконка (см. components/proto/icons.tsx). */
  id: string;
  title: string;
  notable?: boolean; // раздел, где доступны замечания с фото (кузов и салон)
  items: ChecklistItem[];
};
export type ChecklistPhase = {
  id: 'start' | 'process' | 'end';
  phase: string;
  sections: ChecklistSection[];
};

export const CHECKLIST: ChecklistPhase[] = seed.checklist as ChecklistPhase[];

/** Ключ пункта в отметках черновика: фаза + раздел + номер по порядку. */
export function itemKey(phase: string, sectionId: string, idx: number): string {
  return `${phase}_${sectionId}_${idx}`;
}
