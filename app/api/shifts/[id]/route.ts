import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { ApiError, ok, uuid, withUser } from '@/lib/api-helpers';
import { toShift, type ShiftItem, type ShiftRemark, type ShiftRow } from '@/lib/model';
import { signPhotoUrls } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const SHIFT_FIELDS = `id, driver_id, car_id, driver_label, car_label, date_iso::text AS date_iso,
  time_start, time_end, place_start, place_end,
  cash_start, cash_end, cash_expenses, cash_fines, odo_start, odo_end,
  checklist_done, checklist_total, summary_text`;

type Params = { params: Promise<{ id: string }> };

// Подробный отчёт по одной смене: снимок чек-листа целиком, с замечаниями и
// временными ссылками на фото. Открывается по нажатию на смену в истории.
export async function GET(_req: NextRequest, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    uuid(id, 'смена', { required: true });

    const row = await queryOne<ShiftRow & { summary_text: string | null }>(
      `SELECT ${SHIFT_FIELDS} FROM shifts WHERE id = $1`,
      [id]
    );
    if (!row) throw new ApiError('Смена не найдена.', 404);
    // Водитель читает только свои смены.
    if (user.role !== 'admin' && row.driver_id !== user.id) throw new ApiError('Смена не найдена.', 404);

    const itemRows = await query<{
      id: string;
      phase: string;
      section_title: string;
      item_text: string;
      checked: boolean;
      comment: string | null;
      photo_paths: string[];
    }>(
      `SELECT id, phase, section_title, item_text, checked, comment, photo_paths
       FROM shift_items WHERE shift_id = $1 ORDER BY position`,
      [id]
    );

    const items: ShiftItem[] = await Promise.all(
      itemRows.map(async (i) => ({
        id: i.id,
        phase: i.phase,
        sectionTitle: i.section_title,
        text: i.item_text,
        checked: i.checked,
        comment: i.comment ?? '',
        photoUrls: await signPhotoUrls(i.photo_paths),
      }))
    );

    const remarks: ShiftRemark[] = itemRows
      .filter((i) => (i.comment ?? '') !== '' || i.photo_paths.length > 0)
      .map((i) => ({ text: i.item_text, comment: i.comment ?? '', photos: i.photo_paths.length }));

    return ok({ shift: toShift(row, remarks), items, summary: row.summary_text ?? '' });
  });
}
