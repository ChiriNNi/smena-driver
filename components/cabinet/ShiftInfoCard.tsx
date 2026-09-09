'use client';

import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

type Props = {
  icon: IconName;
  title: string;
  confirmed: boolean;
  summary: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  children: ReactNode;
};

// Сворачиваемая карточка «зафиксировать данные» — до подтверждения показывает
// поля ввода, после — компактную сводку с возможностью открыть и поправить.
export default function ShiftInfoCard({ icon, title, confirmed, summary, confirmLabel, confirmDisabled, onConfirm, onEdit, children }: Props) {
  if (confirmed) {
    return (
      <button onClick={onEdit} className="p-card p-fade-up flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
          <Icon name="check" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="truncate text-xs text-[#5c6066]">{summary}</p>
        </div>
        <span className="p-eyebrow shrink-0 text-[#9a9d96]">Изменить</span>
      </button>
    );
  }

  return (
    <div className="p-card p-fade-up p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Icon name={icon} size={16} className="text-[#8fc640]" />{title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
      <button onClick={onConfirm} disabled={confirmDisabled} className="p-btn p-btn-dark mt-4 w-full py-3">
        {confirmLabel}
      </button>
    </div>
  );
}
