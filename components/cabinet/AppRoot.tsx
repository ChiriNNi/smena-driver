'use client';

import { SessionProvider, useSession } from './session';
import { StoreProvider, useStore } from './store';
import PhoneLogin from './PhoneLogin';
import DriverApp from './DriverApp';
import AdminApp from './AdminApp';
import { Icon } from './icons';

// Корень кабинета: пока проверяется сессия — заглушка, дальше вход или
// кабинет по роли.

export default function AppRoot() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const { user, loading, logout } = useSession();

  if (loading) {
    return (
      <div className="app flex h-dvh items-center justify-center bg-[#f8f9f4]">
        <Splash />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app flex h-dvh flex-col bg-[#f8f9f4]">
        <PhoneLogin />
      </div>
    );
  }

  return (
    <div className="app flex h-dvh flex-col bg-[#f8f9f4]">
      <StoreProvider role={user.role}>
        <ErrorBanner />
        <div className="min-h-0 flex-1">
          {user.role === 'admin' ? <AdminApp admin={user} onLogout={logout} /> : <DriverApp driver={user} onLogout={logout} />}
        </div>
      </StoreProvider>
    </div>
  );
}

function Splash() {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип холдинга, next/image не нужен ради одной картинки */}
      <img src="/ic-group-logo.png" alt="IC Group" className="h-14 w-auto opacity-90" />
      <div className="h-1 w-24 overflow-hidden rounded-full bg-[#e7e9e2]">
        <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] rounded-full bg-[#8fc640]" />
      </div>
    </div>
  );
}

/**
 * Плашка ошибки запроса. Висит поверх содержимого, а не заменяет его: если
 * связь пропала посреди смены, водитель должен видеть свой чек-лист, а не
 * пустой экран с ошибкой.
 */
function ErrorBanner() {
  const { error, dismissError } = useStore();
  if (!error) return null;

  return (
    <div className="shrink-0 bg-[#c0564a] px-4 py-2.5 text-white">
      <div className="mx-auto flex max-w-md items-start gap-2">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed">{error}</p>
        <button onClick={dismissError} className="shrink-0 text-xs font-semibold underline">
          Скрыть
        </button>
      </div>
    </div>
  );
}
