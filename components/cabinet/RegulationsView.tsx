'use client';

import { useMemo, useState } from 'react';
import { RULE_KIND_TITLE, type Rule, type RuleKind } from '@/lib/model';
import { useStore } from './store';
import { Icon } from './icons';
import { EmptyState, SegmentedTabs } from './ui';

// Регламенты водителя: обязанности и правила целиком.
//
// Один и тот же экран открывается из вкладки «Правила» (прочитать в любой
// момент) и перед тестом по ТБ — водитель сначала знакомится с регламентом,
// потом отвечает на вопросы.

/** Иконка блока подбирается по ключевым словам заголовка. */
function blockIcon(rule: Rule) {
  const t = rule.title.toLowerCase();
  if (t.includes('внешний вид')) return 'shirt' as const;
  if (t.includes('этикет') || t.includes('поведение')) return 'users' as const;
  if (t.includes('конфиденциальн')) return 'shield' as const;
  if (t.includes('безопасност') || t.includes('вожден')) return 'warning' as const;
  if (t.includes('авто') || t.includes('техническ')) return 'car' as const;
  if (t.includes('касс') || t.includes('расход') || t.includes('отчёт')) return 'wallet' as const;
  if (t.includes('дисциплин') || t.includes('график')) return 'clock' as const;
  if (t.includes('взыскан')) return 'x' as const;
  if (t.includes('обслуживан')) return 'box' as const;
  if (t.includes('дополнительн')) return 'map' as const;
  return 'clipboard' as const;
}

export default function RegulationsView({ compact = false }: { compact?: boolean }) {
  const { rules, loading } = useStore();
  const [kind, setKind] = useState<RuleKind>('rule');

  // Блоки одной категории идут подряд: у обязанностей это «Ежедневно» и
  // «По потребности» внутри одного заголовка.
  const groups = useMemo(() => {
    const list = rules.filter((r) => r.kind === kind);
    const map = new Map<string, Rule[]>();
    for (const rule of list) {
      const bucket = map.get(rule.title);
      if (bucket) bucket.push(rule);
      else map.set(rule.title, [rule]);
    }
    return [...map.entries()];
  }, [rules, kind]);

  const hasDuties = rules.some((r) => r.kind === 'duty');

  if (loading) return <p className="px-4 py-10 text-center text-sm text-[#9a9d96]">Загружаем регламенты…</p>;

  if (rules.length === 0) {
    return (
      <div className="px-4 py-6">
        <EmptyState
          icon="clipboard"
          title="Регламенты не заполнены"
          hint="Администратор ещё не добавил обязанности и правила."
        />
      </div>
    );
  }

  return (
    <div className={'flex flex-col gap-4 ' + (compact ? '' : 'px-4 py-4')}>
      {hasDuties && (
        <SegmentedTabs<RuleKind>
          items={[
            { id: 'rule', label: RULE_KIND_TITLE.rule },
            { id: 'duty', label: RULE_KIND_TITLE.duty },
          ]}
          active={kind}
          onChange={setKind}
        />
      )}

      {groups.map(([title, blocks], i) => (
        <div key={title} className="p-card p-fade-up p-4" style={{ animationDelay: `${Math.min(i, 6) * 0.04}s` }}>
          <h3 className="mb-3 flex items-start gap-2 text-sm font-bold">
            <Icon name={blockIcon(blocks[0])} size={17} className="mt-0.5 shrink-0 text-[#8fc640]" />
            <span className="min-w-0 flex-1">{title}</span>
          </h3>

          {blocks.map((block) => (
            <div key={block.id} className="mb-3 last:mb-0">
              {block.subtitle && <p className="p-eyebrow mb-1.5 text-[#5e9128]">{block.subtitle}</p>}
              {block.body && <p className="mb-2 text-xs leading-relaxed text-[#5c6066]">{block.body}</p>}
              <ul className="flex flex-col gap-2">
                {block.points.map((point, pi) => (
                  <li key={pi} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8fc640]" />
                    <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#1a1d1e]">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
