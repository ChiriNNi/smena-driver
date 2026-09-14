import { ok, withAdmin } from '@/lib/api-helpers';
import { getQuizSummary } from '@/lib/briefing';

export const dynamic = 'force-dynamic';

/** Сводка по тестам: кто как сдаёт и в каких темах ошибаются чаще всего. */
export async function GET() {
  return withAdmin(async () => {
    return ok({ summary: await getQuizSummary() });
  });
}
