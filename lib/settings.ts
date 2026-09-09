import { query, queryOne } from './db';

// Настройки приложения — пары ключ-значение в таблице app_settings.
// Значения хранятся строками: их правит администратор из интерфейса, и
// добавление новой настройки не требует миграции.

export const SETTING_KEYS = {
  /** Сколько дней действует допуск после успешного теста по ТБ. */
  briefingValidDays: 'briefing_valid_days',
  /** Номер получателя сводки в WhatsApp (только цифры) — пусто = общий выбор чата. */
  whatsappTarget: 'whatsapp_target',
} as const;

export const DEFAULT_BRIEFING_VALID_DAYS = 30;

export type AppSettings = {
  briefingValidDays: number;
  whatsappTarget: string;
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await query<{ key: string; value: string | null }>('SELECT key, value FROM app_settings');
  const map = new Map(rows.map((r) => [r.key, r.value ?? '']));

  const days = Number(map.get(SETTING_KEYS.briefingValidDays));
  return {
    briefingValidDays: Number.isFinite(days) && days > 0 ? days : DEFAULT_BRIEFING_VALID_DAYS,
    whatsappTarget: map.get(SETTING_KEYS.whatsappTarget) ?? '',
  };
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string | null }>('SELECT value FROM app_settings WHERE key = $1', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  );
}
