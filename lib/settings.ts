import { query, queryOne } from './db';

// Настройки приложения — пары ключ-значение в таблице app_settings.
// Значения хранятся строками: их правит администратор из интерфейса, и
// добавление новой настройки не требует миграции.

export const SETTING_KEYS = {
  /** Сколько вопросов достаётся водителю из банка на одну попытку. */
  quizPerAttempt: 'quiz_per_attempt',
  /** Сколько верных ответов нужно для допуска. */
  quizPassScore: 'quiz_pass_score',
  /**
   * Сколько часов «живёт» сданный тест, если смена так и не началась.
   * Основное правило другое — тест сдаётся перед каждой сменой, — но без
   * ограничения по времени вчерашняя сдача открывала бы допуск и завтра.
   */
  briefingFreshHours: 'briefing_fresh_hours',
  /** Номер получателя сводки в WhatsApp (только цифры) — пусто = общий выбор чата. */
  whatsappTarget: 'whatsapp_target',
  /** Версия начального наполнения: регламенты и вопросы обновляются по ней. */
  contentVersion: 'content_version',
} as const;

export const DEFAULTS = {
  quizPerAttempt: 5,
  quizPassScore: 5,
  briefingFreshHours: 24,
} as const;

export type AppSettings = {
  quizPerAttempt: number;
  quizPassScore: number;
  briefingFreshHours: number;
  whatsappTarget: string;
};

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await query<{ key: string; value: string | null }>('SELECT key, value FROM app_settings');
  const map = new Map(rows.map((r) => [r.key, r.value ?? '']));

  const perAttempt = num(map.get(SETTING_KEYS.quizPerAttempt), DEFAULTS.quizPerAttempt);
  return {
    quizPerAttempt: perAttempt,
    // Проходной балл не может быть больше числа вопросов в попытке — иначе
    // тест невозможно сдать в принципе.
    quizPassScore: Math.min(num(map.get(SETTING_KEYS.quizPassScore), DEFAULTS.quizPassScore), perAttempt),
    briefingFreshHours: num(map.get(SETTING_KEYS.briefingFreshHours), DEFAULTS.briefingFreshHours),
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
