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
      // Файл один, размером 1337×1289 — браузер сам уменьшит его под нужную
      // иконку, поэтому размеры указаны как any.
      { src: '/ic-group-logo.png', sizes: 'any', type: 'image/png' },
    ],
  };
}
