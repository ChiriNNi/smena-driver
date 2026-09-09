import { NextRequest } from 'next/server';
import { ApiError, num, ok, readBody, str, withAdmin, withUser } from '@/lib/api-helpers';
import { normalizePhone } from '@/lib/phone';
import { getSettings, setSetting, SETTING_KEYS } from '@/lib/settings';
import { isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Настройки приложения. Читают все (водителю нужен номер получателя сводки
// в WhatsApp и срок действия допуска), меняет администратор.

export async function GET() {
  return withUser(async () => {
    return ok({ settings: await getSettings(), photoUploadEnabled: isStorageConfigured() });
  });
}

export async function PUT(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);

    if ('briefingValidDays' in body) {
      const days = num(body, 'briefingValidDays', { required: true, min: 1 });
      if (days > 365) throw new ApiError('Срок действия допуска не может превышать 365 дней.');
      await setSetting(SETTING_KEYS.briefingValidDays, String(Math.round(days)));
    }

    if ('whatsappTarget' in body) {
      const raw = str(body, 'whatsappTarget');
      // Пустое значение — общий выбор чата при отправке (в том числе группы).
      // Непустое проверяем: в ссылку wa.me можно подставить только номер.
      const digits = raw ? normalizePhone(raw) : '';
      if (raw && !digits) throw new ApiError('Номер получателя должен быть в формате +7 7XX XXX XX XX.');
      await setSetting(SETTING_KEYS.whatsappTarget, digits ?? '');
    }

    return ok({ settings: await getSettings() });
  });
}
