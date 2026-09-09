import { query, withTransaction } from './db';
import { ApiError } from './api-helpers';
import { PHASE_TITLE, type PhaseId, type TemplatePhase, type TemplateSection } from './model';

// Шаблон чек-листа: чтение для водителя и полная перезапись из редактора
// администратора.
//
// Правка шаблона не должна ломать историю. Здесь это обеспечено двумя
// решениями: (1) завершённая смена хранит собственный снимок пунктов в
// shift_items, (2) удаление в редакторе — это active = false, физического
// DELETE нет, поэтому ссылки из черновиков остаются валидными.

const PHASES: PhaseId[] = ['start', 'process', 'end'];

type SectionRow = { id: string; phase: PhaseId; title: string; slug: string | null; notable: boolean; position: number };
type ItemRow = { id: string; section_id: string; text: string; qty: string | null; position: number };

/** Актуальный шаблон: три фазы, в каждой — активные разделы и пункты по порядку. */
export async function getTemplate(): Promise<TemplatePhase[]> {
  const [sections, items] = await Promise.all([
    query<SectionRow>(
      `SELECT id, phase, title, slug, notable, position FROM checklist_sections
       WHERE active ORDER BY position, title`
    ),
    query<ItemRow>(
      `SELECT i.id, i.section_id, i.text, i.qty, i.position
       FROM checklist_template_items i
       JOIN checklist_sections s ON s.id = i.section_id
       WHERE i.active AND s.active
       ORDER BY i.position, i.text`
    ),
  ]);

  const bySection = new Map<string, ItemRow[]>();
  for (const item of items) {
    const list = bySection.get(item.section_id);
    if (list) list.push(item);
    else bySection.set(item.section_id, [item]);
  }

  return PHASES.map((phase) => ({
    id: phase,
    phase: PHASE_TITLE[phase],
    sections: sections
      .filter((s) => s.phase === phase)
      .map<TemplateSection>((s) => ({
        id: s.id,
        title: s.title,
        slug: s.slug ?? '',
        notable: s.notable,
        items: (bySection.get(s.id) ?? []).map((i) => (i.qty ? { id: i.id, text: i.text, qty: i.qty } : { id: i.id, text: i.text })),
      })),
  }));
}

export function countTemplateItems(template: TemplatePhase[]): number {
  return template.reduce((sum, ph) => sum + ph.sections.reduce((s, sec) => s + sec.items.length, 0), 0);
}

/* ─── Сохранение из редактора ────────────────────────────────────────────── */

// Приходит та же структура, что и отдаётся, но у новых разделов и пунктов id
// отсутствует (или начинается с 'new') — их создаём, остальные обновляем.
export type TemplateInputItem = { id?: string; text: string; qty?: string };
export type TemplateInputSection = { id?: string; title: string; notable?: boolean; items: TemplateInputItem[] };
export type TemplateInputPhase = { id: PhaseId; sections: TemplateInputSection[] };

function isExistingId(id: string | undefined): id is string {
  return Boolean(id) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id!);
}

export function parseTemplateInput(raw: unknown): TemplateInputPhase[] {
  if (!Array.isArray(raw)) throw new ApiError('Ожидался список фаз чек-листа.');

  return raw.map((phaseRaw) => {
    const phase = phaseRaw as { id?: string; sections?: unknown };
    if (!phase.id || !PHASES.includes(phase.id as PhaseId)) throw new ApiError('Неизвестная фаза чек-листа.');
    if (!Array.isArray(phase.sections)) throw new ApiError('У фазы отсутствует список разделов.');

    return {
      id: phase.id as PhaseId,
      sections: phase.sections.map((sectionRaw) => {
        const section = sectionRaw as { id?: string; title?: string; notable?: boolean; items?: unknown };
        const title = String(section.title ?? '').trim();
        if (!title) throw new ApiError('У раздела не заполнено название.');
        if (!Array.isArray(section.items)) throw new ApiError(`В разделе «${title}» отсутствует список пунктов.`);

        return {
          id: section.id,
          title,
          notable: Boolean(section.notable),
          items: section.items.map((itemRaw) => {
            const item = itemRaw as { id?: string; text?: string; qty?: string };
            const text = String(item.text ?? '').trim();
            if (!text) throw new ApiError(`В разделе «${title}» есть пункт без текста.`);
            const qty = String(item.qty ?? '').trim();
            return qty ? { id: item.id, text, qty } : { id: item.id, text };
          }),
        };
      }),
    };
  });
}

/**
 * Полная перезапись шаблона одной транзакцией: редактор присылает структуру
 * целиком, поэтому частичные обновления не нужны, а атомарность важна —
 * водитель не должен получить чек-лист, собранный из половины правок.
 */
export async function saveTemplate(phases: TemplateInputPhase[]): Promise<void> {
  await withTransaction(async (tx) => {
    const keptSections: string[] = [];
    const keptItems: string[] = [];

    for (const phase of phases) {
      for (const [sectionIndex, section] of phase.sections.entries()) {
        let sectionId: string;

        if (isExistingId(section.id)) {
          const rows = await tx.query<{ id: string }>(
            `UPDATE checklist_sections
             SET title = $2, notable = $3, position = $4, phase = $5, active = true
             WHERE id = $1 RETURNING id`,
            [section.id, section.title, section.notable ?? false, sectionIndex, phase.id]
          );
          // Раздел мог быть удалён в другой вкладке — тогда создаём заново.
          sectionId = rows[0]?.id ?? '';
        } else {
          sectionId = '';
        }

        if (!sectionId) {
          const rows = await tx.query<{ id: string }>(
            `INSERT INTO checklist_sections (phase, title, notable, position)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [phase.id, section.title, section.notable ?? false, sectionIndex]
          );
          sectionId = rows[0].id;
        }
        keptSections.push(sectionId);

        for (const [itemIndex, item] of section.items.entries()) {
          let itemId = '';
          if (isExistingId(item.id)) {
            const rows = await tx.query<{ id: string }>(
              `UPDATE checklist_template_items
               SET text = $2, qty = $3, position = $4, section_id = $5, active = true
               WHERE id = $1 RETURNING id`,
              [item.id, item.text, item.qty ?? null, itemIndex, sectionId]
            );
            itemId = rows[0]?.id ?? '';
          }
          if (!itemId) {
            const rows = await tx.query<{ id: string }>(
              `INSERT INTO checklist_template_items (section_id, text, qty, position)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [sectionId, item.text, item.qty ?? null, itemIndex]
            );
            itemId = rows[0].id;
          }
          keptItems.push(itemId);
        }
      }
    }

    // Всё, чего в присланной структуре не было, помечается неактивным —
    // не удаляется. История и старые черновики остаются целыми.
    await tx.query(`UPDATE checklist_sections SET active = false WHERE active AND NOT (id = ANY($1::uuid[]))`, [
      keptSections,
    ]);
    await tx.query(`UPDATE checklist_template_items SET active = false WHERE active AND NOT (id = ANY($1::uuid[]))`, [
      keptItems,
    ]);
  });
}
