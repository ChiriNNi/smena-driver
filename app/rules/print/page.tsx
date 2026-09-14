import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getBriefingStatus } from '@/lib/briefing';
import { query } from '@/lib/db';
import { toRule, type RuleRow } from '@/lib/model';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Регламент водителя — Smena' };

// Печатная версия регламента: открывается в новой вкладке и сохраняется в PDF
// штатным «Печать → Сохранить как PDF». Отдельная библиотека для генерации PDF
// не нужна — браузер делает это сам, и на телефоне тоже.
//
// Страница серверная: регламент читается из базы под сессией, поэтому по
// прямой ссылке без входа ничего не откроется.

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function RulesPrintPage() {
  const user = await getSessionUser();
  if (!user) redirect('/');

  const [rows, briefing] = await Promise.all([
    query<RuleRow>(
      `SELECT id, kind, title, subtitle, body, points FROM rules WHERE active
       ORDER BY CASE kind WHEN 'duty' THEN 0 ELSE 1 END, position, title`
    ),
    getBriefingStatus(user.id),
  ]);

  const rules = rows.map(toRule);
  const duties = rules.filter((r) => r.kind === 'duty');
  const regulations = rules.filter((r) => r.kind === 'rule');
  const signed = briefing.latest?.signedAt ?? null;

  const today = new Date();
  const printedAt = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

  const section = (title: string, blocks: typeof rules) =>
    blocks.length > 0 && (
      <section>
        <h2>{title}</h2>
        {blocks.map((block) => (
          <div key={block.id} className="block">
            <h3>
              {block.title}
              {block.subtitle && <span className="freq"> · {block.subtitle}</span>}
            </h3>
            <ul>
              {block.points.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    );

  return (
    <div className="sheet">
      {/* Стили страницы держим здесь: это отдельный документ на печать,
          и общие классы кабинета ему не нужны. */}
      <style>{`
        .sheet { max-width: 800px; margin: 0 auto; padding: 32px 24px 64px; color: #1a1d1e;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.5; }
        .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
          border-bottom: 2px solid #8fc640; padding-bottom: 12px; margin-bottom: 24px; }
        .head h1 { font-size: 22px; margin: 0 0 4px; }
        .head p { margin: 0; font-size: 12px; color: #5c6066; }
        .logo { height: 40px; }
        h2 { font-size: 16px; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e7e9e2; }
        .block { margin-bottom: 16px; break-inside: avoid; }
        h3 { font-size: 14px; margin: 0 0 6px; }
        .freq { font-weight: 500; color: #5e9128; }
        ul { margin: 0; padding-left: 20px; }
        li { font-size: 13px; margin-bottom: 4px; }
        .sign { margin-top: 36px; border: 1px solid #e7e9e2; border-radius: 12px; padding: 16px; break-inside: avoid; }
        .sign h3 { margin-bottom: 10px; }
        .sign-row { display: flex; justify-content: space-between; gap: 24px; font-size: 13px; }
        .line { flex: 1; border-bottom: 1px solid #1a1d1e; min-height: 28px; }
        .muted { font-size: 11px; color: #9a9d96; margin-top: 6px; }
        @media print {
          /* Кнопку печатать не нужно, поля задаёт сам браузер. */
          .no-print { display: none; }
          .sheet { padding: 0; max-width: none; }
          @page { margin: 16mm; }
        }
      `}</style>

      <div className="head">
        <div>
          <h1>Регламент водителя</h1>
          <p>
            IC Group · {user.lastName} {user.firstName} · сформировано {printedAt}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип, next/image в печатной версии лишний */}
        <img src="/ic-group-logo.png" alt="IC Group" className="logo" />
      </div>

      <PrintButton />

      {section('Функциональные обязанности', duties)}
      {section('Правила и регламенты', regulations)}

      <div className="sign">
        <h3>Подпись об ознакомлении</h3>
        <div className="sign-row">
          <div>
            <div>
              {user.lastName} {user.firstName}
            </div>
            <div className="muted">ФИО водителя</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="line">{signed ? `подписано в приложении ${formatDateTime(signed)}` : ''}</div>
            <div className="muted">Подпись и дата</div>
          </div>
        </div>
        <p className="muted">
          Ознакомление подтверждается в приложении после сдачи теста: дата, время и результат сохраняются в журнале.
        </p>
      </div>
    </div>
  );
}
