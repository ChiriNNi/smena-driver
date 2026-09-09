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
}: {
  shift: Shift;
  title?: string;
  onClose: () => void;
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

      <div className="p-card mt-3 p-4">
        <CardTitle icon="wallet" title="Касса" />
        <div className="p-card-line flex items-center justify-between py-2 text-sm">
          <span className="text-[#5c6066]">Начало смены</span>
          <span className="font-medium tabular-nums">{money(shift.cashStart)}</span>
        </div>
        <div className="p-card-line flex items-center justify-between py-2 text-sm">
          <span className="text-[#5c6066]">Расходы</span>
          <span className="font-medium tabular-nums">{money(shift.cashExpenses)}</span>
        </div>
        <div className="p-card-line flex items-center justify-between py-2 text-sm">
          <span className="text-[#5c6066]">Штрафы</span>
          <span className={'font-medium tabular-nums ' + (shift.cashFines > 0 ? 'text-[#c0564a]' : '')}>
            {money(shift.cashFines)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 text-sm font-bold">
          <span>Итог смены</span>
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
