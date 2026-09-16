'use client';

import { useSyncExternalStore } from 'react';

// Есть ли сеть. Нужно, чтобы водитель не думал, что данные потерялись: вместо
// «не сохранено — проверьте связь» он видит «нет сети, сохранено в телефоне»
// и продолжает работать, а отправка идёт сама, как только связь вернётся.

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * useSyncExternalStore, а не состояние с эффектом: navigator.onLine — внешнее
 * значение, и читать его нужно в момент рендера, а не после. На сервере
 * снимок всегда «сеть есть», поэтому разметка совпадает с первым рендером в
 * браузере, а настоящее состояние применяется сразу после гидратации.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}
