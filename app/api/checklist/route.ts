import { NextRequest } from 'next/server';
import { ok, withAdmin, withUser } from '@/lib/api-helpers';
import { countTemplateItems, getTemplate, parseTemplateInput, saveTemplate } from '@/lib/checklist-template';

export const dynamic = 'force-dynamic';

// Шаблон чек-листа: читают все, правит администратор из редактора.

export async function GET() {
  return withUser(async () => {
    const template = await getTemplate();
    return ok({ checklist: template, total: countTemplateItems(template) });
  });
}

/**
 * Сохранение из редактора: приходит структура целиком, поэтому это PUT, а не
 * набор POST/DELETE по каждому пункту — редактор правит несколько разделов
 * сразу, и применяться они должны вместе.
 */
export async function PUT(req: NextRequest) {
  return withAdmin(async () => {
    const body = await req.json().catch(() => null);
    const phases = parseTemplateInput((body as { checklist?: unknown } | null)?.checklist);
    await saveTemplate(phases);

    const template = await getTemplate();
    return ok({ checklist: template, total: countTemplateItems(template) });
  });
}
