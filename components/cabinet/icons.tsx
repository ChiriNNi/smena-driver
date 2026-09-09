'use client';

// Единый набор линейных SVG-иконок для прототипа — вместо эмодзи, которые
// по-разному (и не очень аккуратно) рендерятся на разных платформах.
// Стиль: 24×24, currentColor, обводка 1.75 — под общий флэт-язык IC Group.

export type IconName =
  | 'sunrise' | 'zap' | 'moon' // фазы смены
  | 'shirt' | 'box' | 'car' | 'map' | 'wallet' | 'check-circle' | 'pin' // секции чек-листа
  | 'check' | 'warning' | 'camera' | 'plus' | 'x' | 'chevron-up' | 'chevron-down' | 'backspace'
  | 'clipboard' | 'clock' | 'user' | 'id-card' // навигация
  | 'chart' | 'settings' | 'download' | 'calendar' | 'pencil' | 'trash' | 'key' | 'power'
  | 'shield' | 'fuel' | 'wrench' | 'bell' | 'users' | 'arrow-right'; // админка

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
  chart: <path d="M4 20V11M12 20V4M20 20v-7" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M8 11.5 12 15.5l4-4" />
      <path d="M4 19h16" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  pencil: (
    <>
      <path d="M16.5 4.5l3 3L8 19H5v-3z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H21M17.5 12v3.5M20 12v2.5" />
    </>
  ),
  power: (
    <>
      <path d="M12 3.5v7" />
      <path d="M7 6.6a7.5 7.5 0 1010 0" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.5v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
      <path d="M9 12.2l2 2 4-4" />
    </>
  ),
  fuel: (
    <>
      <path d="M5 20V5.5A1.5 1.5 0 016.5 4h5A1.5 1.5 0 0113 5.5V20" />
      <path d="M3.5 20h11" />
      <path d="M6.5 8.5h5" />
      <path d="M13 10h3.5a2 2 0 012 2v4a1.5 1.5 0 003 0v-6l-2.5-3" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.5 6a3.8 3.8 0 105 5l-9 9-4.5 1 1-4.5z" />
      <path d="M14.8 11.2 12 8.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0111 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z" />
      <path d="M10 19a2.2 2.2 0 004 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0111 0" />
      <path d="M16 6.2a3 3 0 010 5.6M17.5 19.5a5.6 5.6 0 00-2-4" />
    </>
  ),
  'arrow-right': <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
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

// Иконку подбираем по коду фазы и по slug раздела — постоянному коду из
// начального набора (car_body_start и т.п.). У разделов, добавленных
// администратором, slug пустой: там иконка по умолчанию.
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
