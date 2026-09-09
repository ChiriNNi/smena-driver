'use client';

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';

/* ─── Поля формы ─────────────────────────────────────────────────────────── */

// Обёртки полей — с min-w-0: в двухколоночной сетке ячейка иначе не может
// стать уже своего содержимого, и широкое поле (дата, время) наезжает на
// соседнее.
export function Field({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="min-w-0">
      <label className="p-eyebrow mb-1.5 block">{label}</label>
      <input className="p-input" {...props} />
      {hint && <p className="mt-1 text-[11px] text-[#9a9d96]">{hint}</p>}
    </div>
  );
}

export function TextField({ label, ...props }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="min-w-0">
      <label className="p-eyebrow mb-1.5 block">{label}</label>
      <textarea className="p-input resize-none" rows={3} {...props} />
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="min-w-0">
      <label className="p-eyebrow mb-1.5 block">{label}</label>
      <select className="p-input" {...props}>
        {children}
      </select>
    </div>
  );
}

/* ─── Блоки и заголовки ──────────────────────────────────────────────────── */

export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="p-eyebrow">{title}</h2>
        {hint && <p className="mt-0.5 truncate text-[10px] text-[#9a9d96]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardTitle({ icon, title, action }: { icon?: IconName; title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        {icon && <Icon name={icon} size={16} className="text-[#8fc640]" />}
        {title}
      </h3>
      {action}
    </div>
  );
}

/** Плитка с крупным числом — как в блоке «О нас в цифрах» на ic-group.kz. */
export function StatTile({ icon, value, label, tone }: { icon: IconName; value: ReactNode; label: string; tone?: 'good' | 'warn' | 'bad' }) {
  const valueColor = tone === 'bad' ? 'text-[#c0564a]' : tone === 'warn' ? 'text-[#b5811c]' : 'text-[#1a1d1e]';
  return (
    <div className="p-card min-w-0 p-4">
      <div className="text-[#8fc640]">
        <Icon name={icon} size={16} />
      </div>
      {/* Размер числа зависит от ширины экрана: «1 234 567» на узком телефоне
          иначе не влезает в половину ширины. */}
      <p className={'mt-2 break-words text-[clamp(1.25rem,6vw,1.5rem)] font-extrabold leading-none tabular-nums ' + valueColor}>
        {value}
      </p>
      <p className="p-eyebrow mt-1.5">{label}</p>
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const styles = {
    neutral: 'bg-white text-[#9a9d96] ring-1 ring-inset ring-[#e7e9e2]',
    good: 'bg-[#8fc640]/15 text-[#5e9128]',
    warn: 'bg-[#b5811c]/12 text-[#96690f]',
    bad: 'bg-[#c0564a]/12 text-[#a0432a]',
    accent: 'bg-[#1a1d1e] text-white',
  }[tone];
  return <span className={'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' + styles}>{children}</span>;
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="p-card flex flex-col items-center px-5 py-8 text-center">
      <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#9a9d96]">
        <Icon name={icon} size={20} />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-[#9a9d96]">{hint}</p>}
    </div>
  );
}

/* ─── Кнопки ─────────────────────────────────────────────────────────────── */

export function IconButton({
  icon,
  label,
  tone = 'neutral',
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  tone?: 'neutral' | 'danger';
  onClick: () => void;
  disabled?: boolean;
}) {
  const color = tone === 'danger' ? 'text-[#c0564a] hover:bg-[#c0564a]/10' : 'text-[#9a9d96] hover:bg-white hover:text-[#1a1d1e]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      // 44×44 — минимальная зона нажатия из требований к мобильному интерфейсу;
      // сама иконка остаётся небольшой.
      className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition disabled:opacity-30 ' + color}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

/* ─── Внутренние вкладки раздела ─────────────────────────────────────────── */

export function SegmentedTabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    // Вкладки делят ширину, пока помещаются; если подписей много и экран узкий —
    // полоса прокручивается, а не ломает строку.
    <div className="flex gap-1.5 overflow-x-auto rounded-full bg-[#f0f1ec] p-1 [scrollbar-width:none]">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={
            'p-btn flex-1 shrink-0 whitespace-nowrap px-3.5 py-1.5 text-[11px] ' +
            (item.id === active ? 'p-btn-primary' : 'bg-transparent text-[#5c6066] hover:text-[#1a1d1e]')
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Шторка / модальное окно ────────────────────────────────────────────── */

export function Sheet({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1a1d1e]/60 sm:items-center sm:p-6" onClick={onClose}>
      <div
        // dvh, а не vh: на телефоне vh считается без учёта панелей браузера,
        // и низ шторки уезжал под адресную строку.
        className="p-fade-up flex max-h-[88dvh] w-full flex-col rounded-t-[28px] bg-white sm:max-w-md sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#e7e9e2] px-5 py-4">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-[#5e9128]">
              <Icon name={icon} size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold">{title}</h3>
            {subtitle && <p className="truncate text-xs text-[#9a9d96]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f6f1] text-[#5c6066] transition hover:bg-[#e7e9e2]"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && (
          <div className="flex gap-2 border-t border-[#e7e9e2] px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Подтверждение необратимого действия — вместо системного confirm(). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Удалить',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a1d1e]/60 p-6" onClick={onCancel}>
      <div className="p-fade-up w-full max-w-sm rounded-[28px] bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#c0564a]/12 text-[#c0564a]">
          <Icon name="warning" size={22} />
        </div>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#5c6066]">{message}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="p-btn p-btn-outline flex-1 py-3 text-xs">
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="p-btn flex-1 bg-[#c0564a] py-3 text-xs text-white transition hover:bg-[#a8452c]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
