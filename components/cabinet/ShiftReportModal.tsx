'use client';

import { useEffect, useState } from 'react';
import * as api from '@/lib/api';
import { formatDate, km, money } from '@/lib/labels';
import type { Shift, ShiftItem } from '@/lib/model';
import { buildShiftSummary, whatsAppLink } from '@/lib/report-text';
import { useSession } from './session';
import { Icon } from './icons';
import { CardTitle, Sheet, StatTile } from './ui';

// Единый отчёт по смене: открывается из истории водителя, из списка смен
// в админке и сразу после завершения смены.
//
// Фото повреждений подгружаются отдельным запросом: в списке смен они не
// нужны, а ссылки на файлы приватного бакета живут ограниченное время, поэтому
// запрашиваются в момент открытия отчёта.

export default function ShiftReportModal({
  shift,
  title = 'Отчёт по смене',
  onClose,
  onRequestEdit,
}: {
  shift: Shift;
  title?: string;
  onClose: () => void;
  /** Задано только у администратора — в кассе появляется кнопка «Исправить». */
  onRequestEdit?: () => void;
}) {
  const { settings } = useSession();
  const [items, setItems] = useState<ShiftItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.shifts
      .detail(shift.id)
      .then((res) => {
        if (alive) setItems(res.items);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [shift.id]);

  const text = buildShiftSummary(shift);
  const mileage = Math.max(0, shift.odoEnd - shift.odoStart);
  const remarkItems = (items ?? []).filter((i) => i.comment !== '' || i.photoUrls.length > 0);
  const skipped = (items ?? []).filter((i) => !i.checked);

  return (
    <Sheet
      icon="check-circle"
      title={title}
      subtitle={`${formatDate(shift.date)} · ${shift.driverLabel} · ${shift.carLabel}`}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={() => navigator.clipboard?.writeText(text)}
            className="p-btn p-btn-outline flex-1 py-3 text-xs"
          >
            Скопировать
          </button>
          <button
            onClick={() => window.open(whatsAppLink(text, settings?.whatsappTarget ?? ''), '_blank')}
            className="p-btn p-btn-primary flex-1 py-3 text-xs"
          >
            Отправить в WhatsApp
          </button>
        </>
      }
    >
      {shift.editedAt && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-[#b5811c]/12 px-3 py-2.5 text-[11px] leading-relaxed font-semibold text-[#96690f]">
          <Icon name="pencil" size={13} className="mt-px shrink-0" />
          Смена исправлена {formatDate(shift.editedAt.slice(0, 10))}
          {shift.editedByLabel && ` · ${shift.editedByLabel}`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon="check-circle"
          value={
            <>
              {shift.done}
              <span className="text-sm font-semibold text-[#9a9d96]">/{shift.total}</span>
            </>
          }
          label="Чек-лист"
        />
        <StatTile icon="car" value={mileage.toLocaleString('ru-RU')} label="Пробег, км" />
      </div>

      <div className="p-card mt-3 p-4">
        <CardTitle icon="map" title="Маршрут" />
        <div className="p-card-line flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-[#5c6066]">Начало</span>
          <span className="text-right font-medium">
            {shift.placeStart}, {shift.timeStart}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-[#5c6066]">Завершение</span>
          <span className="text-right font-medium">
            {shift.placeEnd}, {shift.timeEnd}
          </span>
        </div>
      </div>

      {/* Касса в том же порядке, в каком её ведут на бумаге: остаток должен
          читаться вместе со строками, из которых он получился. */}
      <div className="p-card mt-3 p-4">
        <CardTitle
          icon="wallet"
          title="Касса"
          action={
            onRequestEdit && (
              <button onClick={onRequestEdit} className="p-btn p-btn-outline flex items-center gap-1.5 px-3 py-1.5 text-[11px]">
                <Icon name="pencil" size={12} />
                Исправить
              </button>
            )
          }
        />
        <CashLine label="Начало смены" value={shift.cashStart} />
        <CashLine label="Приход" value={shift.cashIncome} note={shift.cashIncomeNote} />
        <CashLine label="Итого доход" value={shift.cashStart + shift.cashIncome} strong />
        <CashLine label="Расход" value={shift.cashExpenses} note={shift.cashExpensesNote} />
        <CashLine label="Штрафы" value={shift.cashFines} tone={shift.cashFines > 0 ? 'bad' : undefined} />
        <div className="flex items-center justify-between gap-3 py-2 text-sm font-bold">
          <span>Остаток на конец</span>
          <span className="tabular-nums text-[#5e9128]">{money(shift.cashEnd)}</span>
        </div>
      </div>

      <div className="p-card mt-3 p-4">
        <CardTitle icon="clock" title="Одометр" />
        <div className="p-card-line flex items-center justify-between py-2 text-sm">
          <span className="text-[#5c6066]">На начало</span>
          <span className="font-medium tabular-nums">{km(shift.odoStart)}</span>
        </div>
        <div className="flex items-center justify-between py-2 text-sm">
          <span className="text-[#5c6066]">На конец</span>
          <span className="font-medium tabular-nums">{km(shift.odoEnd)}</span>
        </div>
      </div>

      {items === null ? (
        <p className="mt-3 text-center text-xs text-[#9a9d96]">Загружаем чек-лист смены…</p>
      ) : (
        <>
          {remarkItems.length > 0 && (
            <div className="p-card mt-3 p-4">
              <CardTitle icon="warning" title={`Замечания · ${remarkItems.length}`} />
              <div className="flex flex-col gap-2">
                {remarkItems.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white p-2.5 text-sm ring-1 ring-inset ring-[#e7e9e2]">
                    <div className="flex items-center gap-2 font-medium">
                      {r.photoUrls.length > 0 && <Icon name="camera" size={14} className="shrink-0 text-[#9a9d96]" />}
                      <span className="min-w-0 flex-1">{r.text}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-xs leading-relaxed text-[#5c6066]">{r.comment}</p>}
                    {r.photoUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.photoUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element -- временная подписанная ссылка на файл приватного бакета */}
                            <img src={url} alt="Фото замечания" className="h-16 w-16 rounded-xl object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {skipped.length > 0 && (
            <div className="p-card mt-3 p-4">
              <CardTitle icon="x" title={`Не отмечено · ${skipped.length}`} />
              <div className="flex flex-col">
                {skipped.map((i) => (
                  <div key={i.id} className="p-card-line py-2 last:border-none">
                    <p className="text-sm">{i.text}</p>
                    <p className="text-[11px] text-[#9a9d96]">{i.sectionTitle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Строка журнала кассы: сумма и, если была, приписка «от кого» / «на что». */
function CashLine({
  label,
  value,
  note,
  strong,
  tone,
}: {
  label: string;
  value: number;
  note?: string;
  strong?: boolean;
  tone?: 'bad';
}) {
  return (
    <div className="p-card-line flex items-start justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <span className={strong ? 'font-semibold' : 'text-[#5c6066]'}>{label}</span>
        {note && <p className="truncate text-[11px] text-[#9a9d96]">{note}</p>}
      </div>
      <span
        className={
          'shrink-0 tabular-nums ' +
          (strong ? 'font-semibold' : 'font-medium ') +
          (tone === 'bad' ? ' text-[#c0564a]' : '')
        }
      >
        {money(value)}
      </span>
    </div>
  );
}
