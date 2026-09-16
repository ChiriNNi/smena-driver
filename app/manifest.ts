import type { MetadataRoute } from 'next';

// Манифест нужен, чтобы кабинет добавлялся на домашний экран телефона и
// открывался как приложение — без адресной строки и вкладок. Для водителя это
// один тап вместо «открыть браузер, найти закладку».
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smena — кабинет водителя',
    short_name: 'Smena',
    description: 'Чек-лист смены, инструктаж по ТБ и отчёты',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f9f4',
    theme_color: '#f8f9f4',
    lang: 'ru',
    icons: [
      // Иконка собирается из логотипа на сборке (app/icon.tsx): логотип
      // прямоугольный, а Android обрезает иконку до круга, поэтому нужен
      // квадрат с полями. Сам логотип как есть сюда не годится — по краям он
      // срезался.
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
