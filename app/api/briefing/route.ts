import { NextRequest } from 'next/server';
import { ok, uuid, withUser } from '@/lib/api-helpers';
import { getBriefingStatus } from '@/lib/briefing';

export const dynamic = 'force-dynamic';

/**
 * Состояние допуска по ТБ: сдан ли тест, до какой даты действует.
 * По умолчанию — своё; администратор может запросить состояние конкретного
 * водителя (?driverId=…) для карточки в списке водителей.
 */
export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const requested = uuid(req.nextUrl.searchParams.get('driverId'), 'водитель');
    const driverId = user.role === 'admin' && requested ? requested : user.id;
    return ok({ briefing: await getBriefingStatus(driverId) });
  });
}
