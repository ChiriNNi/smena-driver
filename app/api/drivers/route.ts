import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPin } from '@/lib/auth';
import { ApiError, dateISO, ok, readBody, str, todayISO, uuid, withAdmin, withUser } from '@/lib/api-helpers';
import { toDriver, type DriverRow } from '@/lib/model';
import { isValidPin, normalizePhone, pinFromPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

const FIELDS = 'id, last_name, first_name, phone_digits, role, active, car_id, hired_at::text AS hired_at';

// Профили водителей и администраторов. Регистрирует только администратор —
// самостоятельной регистрации в системе нет (согласовано в спецификации).

export async function GET() {
  return withUser(async (user) => {
    // Водителю список коллег не нужен и не положен — он получает только себя.
    if (user.role !== 'admin') return ok({ drivers: [user] });

    const rows = await query<DriverRow>(`SELECT ${FIELDS} FROM drivers ORDER BY active DESC, last_name, first_name`);
    return ok({ drivers: rows.map(toDriver) });
  });
}

export async function POST(req: NextRequest) {
  return withAdmin(async () => {
    const body = await readBody(req);
    const lastName = str(body, 'lastName', { required: true, max: 80 });
    const firstName = str(body, 'firstName', { required: true, max: 80 });
    const phone = normalizePhone(str(body, 'phone', { required: true }));
    if (!phone) throw new ApiError('Номер телефона должен быть казахстанским мобильным: +7 7XX XXX XX XX.');

    const role = str(body, 'role') === 'admin' ? 'admin' : 'driver';
    const carId = uuid(str(body, 'carId') || null, 'автомобиль');
    const hiredAt = dateISO(body, 'hiredAt') || todayISO();

    // PIN по умолчанию — последние 4 цифры номера. Администратор может задать
    // свой, но хранится всегда только bcrypt-хэш.
    const pin = str(body, 'pin') || pinFromPhone(phone);
    if (!isValidPin(pin)) throw new ApiError('PIN должен состоять из 4 цифр.');

    const row = await queryOne<DriverRow>(
      `INSERT INTO drivers (last_name, first_name, phone_digits, pin_hash, role, car_id, hired_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${FIELDS}`,
      [lastName, firstName, phone, await hashPin(pin), role, carId, hiredAt]
    );
    if (!row) throw new ApiError('Не удалось создать профиль.', 500);

    return ok({ driver: toDriver(row) });
  });
}
