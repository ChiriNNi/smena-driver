import { NextRequest } from 'next/server';
import { ApiError, ok, withUser } from '@/lib/api-helpers';
import { deletePhoto, isStorageConfigured, signPhotoUrl, uploadPhoto } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Загрузка фото к замечанию чек-листа.
//
// Файл идёт через сервер, а не напрямую в Supabase: секретный ключ проекта
// нельзя показывать браузеру, а бакет приватный. В ответ возвращается путь (его
// водитель приложит к смене) и временная ссылка для превью на экране.

export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    if (!isStorageConfigured()) {
      throw new ApiError('Загрузка фото не настроена: задайте SUPABASE_URL и SUPABASE_SECRET_KEY.', 503);
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new ApiError('Файл не получен.');

    const path = await uploadPhoto(user.id, file);
    return ok({ path, url: await signPhotoUrl(path) });
  });
}

/** Удаление только что приложенного фото (водитель передумал). */
export async function DELETE(req: NextRequest) {
  return withUser(async (user) => {
    const path = req.nextUrl.searchParams.get('path') ?? '';
    // Свой файл узнаётся по префиксу пути — id водителя (см. buildPhotoPath).
    if (!path.startsWith(`${user.id}/`)) throw new ApiError('Файл не найден.', 404);

    await deletePhoto(path);
    return ok({ ok: true });
  });
}
