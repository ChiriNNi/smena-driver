import { NextRequest } from 'next/server';
import { authenticate, clearSessionCookie, getSessionUser, setSessionCookie, slideSession } from '@/lib/auth';
import { handle, jsonError, ok, readBody, str, withUser } from '@/lib/api-helpers';
import { getBriefingStatus } from '@/lib/briefing';
import { isValidPin, normalizePhone } from '@/lib/phone';
import { getSettings } from '@/lib/settings';
import { isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Вход, выход и «кто я». GET вызывается при каждом запуске приложения:
// одновременно продлевает сессию и отдаёт всё, что нужно для первого экрана —
// профиль, состояние допуска по ТБ, настройки и признак настроенного
// хранилища фото (без него кнопка съёмки не показывается).

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) return ok({ user: null });

    await slideSession(user);
    const [briefing, settings] = await Promise.all([getBriefingStatus(user.id), getSettings()]);
    return ok({ user, briefing, settings, photoUploadEnabled: isStorageConfigured() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readBody(req);
    const phone = normalizePhone(str(body, 'phone', { required: true }));
    const pin = str(body, 'pin', { required: true });

    // Формат проверяем до обращения к БД, но текст ошибки одинаковый для
    // неверного номера и неверного PIN — иначе форма входа превращается
    // в способ узнать, какие номера зарегистрированы.
    if (!phone || !isValidPin(pin)) return jsonError('Неверный номер или PIN.', 401);

    const result = await authenticate(phone, pin);
    if (!result.ok) {
      // О блокировке сообщаем прямо: иначе водитель будет думать, что забыл
      // PIN, и звонить администратору вместо того, чтобы подождать.
      if (result.lockedMinutes) {
        return jsonError(
          `Слишком много неверных попыток. Вход заблокирован на ${result.lockedMinutes} мин. ` +
            'Если PIN забыт — попросите администратора сбросить его.',
          429
        );
      }
      return jsonError('Неверный номер или PIN.', 401);
    }

    const user = result.user;
    await setSessionCookie(user.id, user.role);
    const [briefing, settings] = await Promise.all([getBriefingStatus(user.id), getSettings()]);
    return ok({ user, briefing, settings, photoUploadEnabled: isStorageConfigured() });
  });
}

export async function DELETE() {
  return withUser(async () => {
    await clearSessionCookie();
    return ok({ ok: true });
  });
}
