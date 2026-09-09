import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPin } from '@/lib/auth';
import { ApiError, dateISO, ok, readBody, str, uuid, withAdmin } from '@/lib/api-helpers';
import { toDriver, type DriverRow } from '@/lib/model';
import { isValidPin, normalizePhone, pinFromPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, last_name, first_name, phone_digits, role, active, car_id, hired_at::text AS hired_at';

type Params = { params: Promise<{ id: string }> };

/**
 * Правка профиля: ФИО, телефон, авто, роль, сброс PIN, отключение доступа.
 * Присылаются только изменённые поля — собираем SET динамически.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin(async (admin) => {
    const { id } = await params;
    uuid(id, 'водитель', { required: true });
    const body = await readBody(req);

    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if ('lastName' in body) set('last_name', str(body, 'lastName', { required: true, max: 80 }));
    if ('firstName' in body) set('first_name', str(body, 'firstName', { required: true, max: 80 }));

    if ('phone' in body) {
      const phone = normalizePhone(str(body, 'phone', { required: true }));
      if (!phone) throw new ApiError('Номер телефона должен быть казахстанским мобильным: +7 7XX XXX XX XX.');
      set('phone_digits', phone);
    }

    if ('carId' in body) set('car_id', uuid(str(body, 'carId') || null, 'автомобиль'));
    if ('hiredAt' in body) set('hired_at', dateISO(body, 'hiredAt', { required: true }));

    if ('role' in body) {
      const role = str(body, 'role') === 'admin' ? 'admin' : 'driver';
      // Иначе администратор может случайно отобрать доступ у самого себя и
      // остаться без входа в админку.
      if (id === admin.id && role !== 'admin') throw new ApiError('Нельзя снять роль администратора с себя.');
      set('role', role);
    }

    if ('active' in body) {
      const active = Boolean(body.active);
      if (id === admin.id && !active) throw new ApiError('Нельзя отключить собственный аккаунт.');
      set('active', active);
    }

    // resetPin: true — вернуть PIN к последним 4 цифрам номера (сценарий
    // «водитель забыл PIN»). Либо pin — задать конкретный.
    if (body.resetPin === true || 'pin' in body) {
      const current = await queryOne<{ phone_digits: string }>('SELECT phone_digits FROM drivers WHERE id = $1', [id]);
      if (!current) throw new ApiError('Водитель не найден.', 404);
      const phone = 'phone' in body ? (normalizePhone(str(body, 'phone')) ?? current.phone_digits) : current.phone_digits;
      const pin = body.resetPin === true ? pinFromPhone(phone) : str(body, 'pin', { required: true });
      if (!isValidPin(pin)) throw new ApiError('PIN должен состоять из 4 цифр.');
      set('pin_hash', await hashPin(pin));
      // Сброс PIN снимает и блокировку от подбора: иначе водителю, который
      // забыл PIN и заблокировал вход, пришлось бы ещё ждать 15 минут.
      set('failed_attempts', 0);
      set('locked_until', null);
    }

    if (sets.length === 0) throw new ApiError('Нечего обновлять.');

    values.push(id);
    const row = await queryOne<DriverRow>(
      `UPDATE drivers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING ${FIELDS}`,
      values
    );
    if (!row) throw new ApiError('Водитель не найден.', 404);

    return ok({ driver: toDriver(row) });
  });
}

/**
 * Удаление профиля. Если по водителю уже есть смены, удалять нельзя —
 * иначе из истории пропадёт автор отчёта; вместо этого доступ отключается
 * флагом active (тот же смысл для администратора, но история цела).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAdmin(async (admin) => {
    const { id } = await params;
    uuid(id, 'водитель', { required: true });
    if (id === admin.id) throw new ApiError('Нельзя удалить собственный аккаунт.');

    const used = await queryOne<{ n: string }>('SELECT count(*)::text AS n FROM shifts WHERE driver_id = $1', [id]);
    if (Number(used?.n ?? 0) > 0) {
      throw new ApiError('По водителю есть завершённые смены — профиль можно только отключить, чтобы не потерять историю.', 409);
    }

    await query('DELETE FROM drivers WHERE id = $1', [id]);
    return ok({ ok: true });
  });
}
