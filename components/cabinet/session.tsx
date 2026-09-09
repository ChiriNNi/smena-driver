'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '@/lib/api';
import type { BriefingStatus, Driver } from '@/lib/model';
import type { AppSettings } from '@/lib/settings';

// Текущий пользователь, его допуск по ТБ и настройки приложения.
//
// Сессия живёт в httpOnly-cookie, поэтому клиент не хранит ни токена, ни PIN:
// при запуске он просто спрашивает сервер «кто я». Тот же запрос продлевает
// срок сессии — водитель, открывающий кабинет каждую смену, PIN больше не
// вводит.

type Session = {
  user: Driver | null;
  briefing: BriefingStatus | null;
  settings: AppSettings | null;
  photoUploadEnabled: boolean;
  /** Идёт проверка сессии — до её конца нельзя показывать ни вход, ни кабинет. */
  loading: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Перечитать допуск: после прохождения теста по ТБ. */
  refreshBriefing: () => Promise<void>;
};

const DEFAULT_SETTINGS: AppSettings = { briefingValidDays: 30, whatsappTarget: '' };

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Driver | null>(null);
  const [briefing, setBriefing] = useState<BriefingStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [photoUploadEnabled, setPhotoUploadEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((res: api.SessionResponse) => {
    setUser(res.user);
    setBriefing(res.briefing ?? null);
    setSettings(res.settings ?? DEFAULT_SETTINGS);
    setPhotoUploadEnabled(Boolean(res.photoUploadEnabled));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        apply(await api.session.me());
      } catch {
        // Сети нет или сервер недоступен — показываем экран входа.
        setUser(null);
      }
      setLoading(false);
    })();
  }, [apply]);

  const value: Session = {
    user,
    briefing,
    settings,
    photoUploadEnabled,
    loading,
    login: async (phone, pin) => {
      // Ошибку не перехватываем: форма входа показывает её сама.
      apply(await api.session.login(phone, pin));
    },
    logout: async () => {
      try {
        await api.session.logout();
      } finally {
        setUser(null);
        setBriefing(null);
      }
    },
    refreshBriefing: async () => {
      try {
        setBriefing(await api.briefing.status());
      } catch {
        /* допуск перечитается при следующем запуске */
      }
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession вызван вне SessionProvider');
  return session;
}
