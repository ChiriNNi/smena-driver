'use client';

import { Icon, type IconName } from './icons';

// Плавающий «островок» — панель с отступами от краёв экрана и со скруглением
// со всех сторон, а не сплошная полоса во всю ширину. Внутри — скользящая
// зелёная подсветка активной вкладки, которая переезжает transform'ом.
// Все вкладки равной ширины (flex-1), поэтому позиция считается просто как
// index * 100%, без измерения DOM через JS.

export type BottomNavItem<T extends string> = { id: T; icon: IconName; label: string };

export default function BottomNav<T extends string>({
  items,
  active,
  onChange,
}: {
  items: BottomNavItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const idx = Math.max(
    0,
    items.findIndex((i) => i.id === active)
  );

  return (
    <nav className="fixed inset-x-6 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-[20px] border border-[#e7e9e2] bg-white p-1 shadow-[0_10px_30px_-8px_rgba(26,29,30,0.15)]">
      <div className="relative flex">
        <span
          className="absolute inset-y-0 rounded-2xl bg-[#8fc640] transition-transform duration-300 ease-out"
          style={{ width: `${100 / items.length}%`, transform: `translateX(${idx * 100}%)` }}
          aria-hidden="true"
        />
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className="relative z-10 flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition-colors duration-300"
            >
              <Icon name={item.icon} size={15} className={isActive ? 'text-white' : 'text-[#9a9d96]'} />
              <span className={isActive ? 'text-white' : 'text-[#9a9d96]'}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
