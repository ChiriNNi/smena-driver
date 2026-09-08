-- Схема базы данных Smena. Выполнить один раз на новой базе (Supabase Postgres).
-- Повторный запуск безопасен (IF NOT EXISTS везде, где возможно).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Водители ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Настройки приложения: PIN администратора ────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ── Смены (архив завершённых смен = "История смен") ─────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name_cache TEXT,                     -- имя на момент смены (на случай удаления/переименования водителя)
  date_iso          DATE NOT NULL,
  time_start        TEXT,
  time_end          TEXT,
  place_start       TEXT,
  place_end         TEXT,
  cars              TEXT[] NOT NULL DEFAULT '{}',
  cash_start        NUMERIC,
  cash_end          NUMERIC,
  cash_expenses     NUMERIC,
  cash_fines        NUMERIC,
  checklist_done    INTEGER NOT NULL DEFAULT 0,
  checklist_total   INTEGER NOT NULL DEFAULT 0,
  summary_text      TEXT,
  client_request_id TEXT UNIQUE,               -- ключ идемпотентности: защита от двойного завершения смены
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Отметки чек-листа и заметки/фото по конкретной смене
CREATE TABLE IF NOT EXISTS checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  phase      TEXT NOT NULL,     -- start | process | finish
  section    TEXT NOT NULL,
  item_key   TEXT NOT NULL,
  checked    BOOLEAN NOT NULL DEFAULT false,
  note_text  TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_shift ON checklist_items(shift_id);

-- Текущий (незавершённый) чек-лист — по одному "черновику" на активную смену водителя
CREATE TABLE IF NOT EXISTS draft_shift (
  driver_id  UUID PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',   -- shiftInfo (даты/время/касса/одометры) + checked + notes
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Автопарк ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mileage (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  shift_id  UUID REFERENCES shifts(id) ON DELETE SET NULL,
  car       TEXT NOT NULL,
  odo_start NUMERIC NOT NULL,
  odo_end   NUMERIC NOT NULL,
  date_iso  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID REFERENCES drivers(id) ON DELETE SET NULL,
  shift_id    UUID REFERENCES shifts(id) ON DELETE SET NULL,
  category    TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  title       TEXT,
  receipt_url TEXT,
  date_iso    DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  UUID REFERENCES drivers(id) ON DELETE SET NULL,
  date_iso   DATE NOT NULL,
  time_start TEXT,
  time_end   TEXT,
  car        TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  type      TEXT NOT NULL,
  due_date  DATE NOT NULL,
  note      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Правила: подписи об ознакомлении ────────────────────────────────────
CREATE TABLE IF NOT EXISTS rule_acks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name TEXT NOT NULL,
  quiz_score  INTEGER NOT NULL,
  quiz_total  INTEGER NOT NULL,
  passed      BOOLEAN NOT NULL,
  signed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date_iso);
CREATE INDEX IF NOT EXISTS idx_shifts_driver ON shifts(driver_id);
CREATE INDEX IF NOT EXISTS idx_mileage_driver ON mileage(driver_id);
CREATE INDEX IF NOT EXISTS idx_expenses_driver ON expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule(date_iso);
