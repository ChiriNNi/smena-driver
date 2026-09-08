'use client';

import {
  buildShiftReportText,
  carLabel,
  driverName,
  formatDate,
  km,
  money,
  type ProtoShift,
} from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { CardTitle, Sheet, StatTile } from './ui';

// Единый отчёт по смене: открывается из истории водителя, из списка смен
// в админке и сразу после завершения смены.

export default function ShiftReportModal({
  shift,
  title = 'Отчёт по смене',
  onClose,
}: {
  shift: ProtoShift;
  title?: string;
  onClose: () => void;
}) {
  const { drivers, cars } = useStore();
  const text = buildShiftReportText(shift, drivers, cars);
  const mileage = Math.max(0, shift.odoEnd - shift.odoStart);

  return (
    <Sheet
      icon="check-circle"
      title={title}
      subtitle={`${formatDate(shift.date)} · ${driverName(drivers, shift.driverId)} · ${carLabel(cars, shift.carId)}`}
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
            onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')}
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
          <span className="text-right font-medium">{shift.placeStart}, {shift.timeStart}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-[#5c6066]">Завершение</span>
          <span className="text-right font-medium">{shift.placeEnd}, {shift.timeEnd}</span>
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

      {shift.remarks.length > 0 && (
        <div className="p-card mt-3 p-4">
          <CardTitle icon="warning" title={`Замечания · ${shift.remarks.length}`} />
          <div className="flex flex-col gap-2">
            {shift.remarks.map((r, i) => (
              <div key={i} className="rounded-2xl bg-white p-2.5 text-sm ring-1 ring-inset ring-[#e7e9e2]">
                <div className="flex items-center gap-2 font-medium">
                  {!!r.photos && <Icon name="camera" size={14} className="shrink-0 text-[#9a9d96]" />}
                  <span className="min-w-0 flex-1">{r.text}</span>
                  {!!r.photos && <span className="shrink-0 text-xs text-[#9a9d96]">{r.photos}</span>}
                </div>
                {r.comment && <p className="mt-1 text-xs leading-relaxed text-[#5c6066]">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
