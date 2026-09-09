import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

// Шрифт отдаётся с нашего же домена: у водителя в дороге мобильный интернет,
// и лишний запрос к сторонним шрифтам — это и задержка первого экрана, и риск
// увидеть страницу без шрифта.
const montserrat = Montserrat({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Smena — кабинет водителя',
  description: 'Чек-лист смены, инструктаж по ТБ и отчёты для водителей IC Group',
  // Кабинет закрытый: индексировать его в поиске нечего.
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Smena', statusBarStyle: 'default' },
  icons: { icon: '/ic-group-logo.png', apple: '/ic-group-logo.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Экран разворачивается под весь дисплей, включая область вокруг «выреза»:
  // без этого env(safe-area-inset-bottom) равен нулю и нижняя панель
  // перекрывается полосой жестов на iPhone.
  viewportFit: 'cover',
  themeColor: '#f8f9f4',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ru" className={`h-full ${montserrat.variable}`}>
      <body className="min-h-full bg-[#f8f9f4] text-[#1a1d1e] antialiased">{children}</body>
    </html>
  );
}
