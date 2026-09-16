import { queryOne } from './db';
import { deletePhoto } from './storage';

// Уборка фото, которые никуда не попали.
//
// Водитель фотографирует повреждение, потом передумывает и снимает замечание —
// или бросает черновик и на следующий день начинает смену заново. Файл при
// этом остаётся в бакете навсегда: смена его не упоминает, удалить его некому.
// Здесь собирается, что было в черновике, и удаляется всё, что не пригодилось.

/** Все пути к фото, упомянутые в черновике водителя. */
export async function collectDraftPhotoPaths(driverId: string): Promise<string[]> {
  const row = await queryOne<{ data: unknown }>('SELECT data FROM shift_drafts WHERE driver_id = $1', [driverId]);
  return extractPhotoPaths(row?.data);
}

/**
 * Пути к фото внутри черновика. Структура черновика меняется вместе с
 * интерфейсом, поэтому ищем не по конкретным полям, а по форме: строка,
 * похожая на путь в бакете, в значении с ключом path.
 */
export function extractPhotoPaths(data: unknown): string[] {
  const found = new Set<string>();

  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'path' && typeof child === 'string' && child.includes('/')) found.add(child);
      else walk(child);
    }
  };

  walk(data);
  return [...found];
}

/**
 * Удаляет файлы, которые были в черновике, но не вошли в итоговый набор.
 * Ошибки только логируются: смена важнее, чем лишний файл в бакете, и падать
 * из-за неудавшейся уборки нельзя.
 */
export async function discardUnusedPhotos(before: string[], after: string[]): Promise<void> {
  const keep = new Set(after);
  const drop = before.filter((p) => !keep.has(p));
  if (drop.length === 0) return;

  await Promise.all(
    drop.map((path) =>
      deletePhoto(path).catch((err) => {
        console.error('[photos] не удалось убрать неиспользованное фото', path, err);
      })
    )
  );
}
