// Работа с Supabase Storage через его REST-эндпоинты.
//
// Почему без библиотеки @supabase/supabase-js: нам нужны ровно три операции
// (загрузить, выдать временную ссылку, удалить), и все они — один fetch.
// Зависимость ради этого не окупается, а service_role-ключ всё равно нельзя
// отдавать в браузер, поэтому клиентская часть SDK бесполезна.
//
// Бакет приватный: наружу уходят только подписанные ссылки с ограниченным
// сроком, поэтому фото повреждений не доступны по угадываемому адресу.

import { ApiError } from './api-helpers';

export const PHOTO_BUCKET = 'shift-photos';

/** Сколько живёт подписанная ссылка на фото: хватает открыть отчёт и посмотреть. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ApiError(
      'Хранилище фото не настроено: задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в переменных окружения.',
      503
    );
  }
  return { url: url.replace(/\/+$/, ''), key };
}

/** Настроено ли хранилище — чтобы интерфейс мог скрыть загрузку фото, а не падать. */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, apikey: key };
}

function extensionFor(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Путь внутри бакета: раскладка по водителю и дате, чтобы файлы можно было
 * найти и почистить руками, а имя — случайное, без данных о содержимом.
 */
export function buildPhotoPath(driverId: string, mime: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomUUID();
  return `${driverId}/${day}/${rand}.${extensionFor(mime)}`;
}

export async function uploadPhoto(driverId: string, file: File): Promise<string> {
  const { url, key } = config();

  if (!ALLOWED_MIME.includes(file.type)) {
    throw new ApiError('Допустимы только изображения JPEG, PNG или WebP.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError('Файл больше 6 МБ. Фото сжимается на телефоне перед отправкой — попробуйте снять заново.');
  }

  const path = buildPhotoPath(driverId, file.type);
  const res = await fetch(`${url}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(key), 'Content-Type': file.type, 'cache-control': '3600' },
    body: await file.arrayBuffer(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[storage] upload failed', res.status, detail);
    if (res.status === 404) throw new ApiError(`Бакет «${PHOTO_BUCKET}» не найден в Supabase Storage.`, 500);
    throw new ApiError('Не удалось загрузить фото. Попробуйте ещё раз.', 502);
  }

  return path;
}

/** Временная ссылка на файл приватного бакета. */
export async function signPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/sign/${PHOTO_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });
  if (!res.ok) {
    console.error('[storage] sign failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = (await res.json()) as { signedURL?: string };
  return data.signedURL ? `${url}/storage/v1${data.signedURL}` : null;
}

/** Подписывает список путей; недоступные файлы просто выпадают из результата. */
export async function signPhotoUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0 || !isStorageConfigured()) return [];
  const signed = await Promise.all(paths.map((p) => signPhotoUrl(p)));
  return signed.filter((u): u is string => Boolean(u));
}

export async function deletePhoto(path: string): Promise<void> {
  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: 'DELETE',
    headers: authHeaders(key),
  });
  if (!res.ok && res.status !== 404) {
    console.error('[storage] delete failed', res.status, await res.text().catch(() => ''));
    throw new ApiError('Не удалось удалить фото.', 502);
  }
}
