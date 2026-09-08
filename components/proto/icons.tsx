'use client';

// Единый набор линейных SVG-иконок для прототипа — вместо эмодзи, которые
// по-разному (и не очень аккуратно) рендерятся на разных платформах.
// Стиль: 24×24, currentColor, обводка 1.75 — под общий флэт-язык IC Group.

export type IconName =
  | 'sunrise' | 'zap' | 'moon' // фазы смены
  | 'shirt' | 'box' | 'car' | 'map' | 'wallet' | 'check-circle' | 'pin' // секции чек-листа
  | 'check' | 'warning' | 'camera' | 'plus' | 'x' | 'chevron-up' | 'chevron-down' | 'backspace'
  | 'clipboard' | 'clock' | 'user' | 'id-card'; // навигация

const PATHS: Record<IconName, React.ReactNode> = {
  sunrise: (
    <>
      <path d="M12 2v4" />
      <path d="M5 12a7 7 0 0114 0" />
      <path d="M3 12h1M20 12h1M5.6 6.6l.9.9M17.5 7.5l.9-.9" />
      <path d="M2 18h20" />
    </>
  ),
  zap: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
  moon: <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />,
  shirt: (
    <>
      <circle cx="12" cy="7.5" r="3" />
      <path d="M5 21v-2a7 7 0 0114 0v2" />
    </>
  ),
  box: (
    <>
      <path d="M21 8 12 3 3 8l9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  car: (
    <>
      <path d="M5 11 6.5 6.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11" />
      <path d="M3 13a2 2 0 012-2h14a2 2 0 012 2v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
    </>
  ),
  map: (
    <>
      <path d="M21 10c0 6.5-9 12-9 12s-9-5.5-9-12a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.3 2.3L16 10" />
    </>
  ),
  pin: <path d="M6 3h12v18l-6-4-6 4V3z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  warning: (
    <>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10.5v3.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.6-2.4A1 1 0 019.4 5h5.2a1 1 0 01.8.6L16.9 8H20a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a1 1 0 011-1z" />
      <circle cx="12" cy="14" r="3.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  backspace: (
    <>
      <path d="M9 4h11a1 1 0 011 1v14a1 1 0 01-1 1H9l-6-8 6-8z" />
      <path d="M14 9.5l5 5M19 9.5l-5 5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <path d="M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 3.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0113 0" />
    </>
  ),
  'id-card': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.8" />
      <path d="M5.8 15.5a2.8 2.8 0 015.4 0" />
      <path d="M13.5 9.5h4M13.5 13h4" />
    </>
  ),
};

export function Icon({ name, className, size = 20 }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// Секции чек-листа приходят из lib/checklist-data.ts с эмодзи в поле icon —
// эти данные общие с legacy-приложением на "/", поэтому сами их не трогаем,
// а в прототипе просто подбираем SVG-иконку по id секции/фазы.
export function phaseIconName(phaseId: string): IconName {
  if (phaseId === 'start') return 'sunrise';
  if (phaseId === 'process') return 'zap';
  return 'moon';
}

export function sectionIconName(sectionId: string): IconName {
  if (sectionId.startsWith('appearance')) return 'shirt';
  if (sectionId.startsWith('car_supply')) return 'box';
  if (sectionId.startsWith('car_body')) return 'car';
  if (sectionId.startsWith('schedule')) return 'map';
  if (sectionId.startsWith('cash')) return 'wallet';
  if (sectionId.startsWith('process_main')) return 'check-circle';
  return 'pin'; // произвольная секция, добавленная администратором
}
