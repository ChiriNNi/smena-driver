-- Схема базы данных Smena (Supabase Postgres).
-- Применяется командой `npm run db:migrate`; повторный запуск безопасен.
--
-- Принципы, заложенные в схему:
--  • Водители и администраторы — одна таблица drivers, различаются полем role.
--  • История смены неизменяема: пункты чек-листа копируются в shift_items
--    вместе с текстом на момент смены, поэтому правки шаблона её не ломают.
--  • Шаблон чек-листа, правила и вопросы теста живут в БД — их правит
--    администратор из интерфейса, без изменения кода.
--  • Удаление того, на что уже ссылается история, делается флагом active,
--    а не DELETE (см. checklist_sections, checklist_template_items, cars).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* ─── Автомобили ─────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS cars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model      TEXT NOT NULL,
  plate      TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ─── Водители и администраторы ──────────────────────────────────────────── */

-- phone_digits — номер только из цифр (77012345678): по нему идёт вход, поэтому
-- уникальность проверяется на нормализованном виде, а не на форматированном.
CREATE TABLE IF NOT EXISTS drivers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name    TEXT NOT NULL,
  first_name   TEXT NOT NULL,
  phone_digits TEXT NOT NULL UNIQUE CHECK (phone_digits ~ '^7[0-9]{10}$'),
  pin_hash     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'admin')),
  active       BOOLEAN NOT NULL DEFAULT true,
  car_id       UUID REFERENCES cars(id) ON DELETE SET NULL,
  hired_at     DATE NOT NULL DEFAULT current_date,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drivers_role ON drivers(role);

-- Защита от подбора PIN: он всего из 4 цифр, то есть 10 000 вариантов —
-- без ограничения попыток перебирается скриптом за минуты.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

/* ─── Шаблон чек-листа (правится администратором) ────────────────────────── */

CREATE TABLE IF NOT EXISTS checklist_sections (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase    TEXT NOT NULL CHECK (phase IN ('start', 'process', 'end')),
  title    TEXT NOT NULL,
  -- slug — постоянный код раздела из начального набора (car_body_start и т.п.):
  -- по нему интерфейс подбирает иконку. У разделов, добавленных
  -- администратором, его нет — там иконка по умолчанию.
  slug     TEXT,
  -- notable = в разделе можно оставить замечание с фото (кузов, салон)
  notable  BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS checklist_template_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES checklist_sections(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  qty        TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_template_items_section ON checklist_template_items(section_id);

/* ─── Смены ──────────────────────────────────────────────────────────────── */

-- driver_label / car_label — подписи на момент смены: водителя могут
-- переименовать, машину продать, а отчёт за прошлый месяц должен остаться
-- читаемым ровно таким, каким его сдали.
CREATE TABLE IF NOT EXISTS shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID REFERENCES drivers(id) ON DELETE SET NULL,
  car_id            UUID REFERENCES cars(id) ON DELETE SET NULL,
  driver_label      TEXT NOT NULL,
  car_label         TEXT NOT NULL,
  date_iso          DATE NOT NULL,
  time_start        TEXT NOT NULL DEFAULT '',
  time_end          TEXT NOT NULL DEFAULT '',
  place_start       TEXT NOT NULL DEFAULT '',
  place_end         TEXT NOT NULL DEFAULT '',
  cash_start        NUMERIC NOT NULL DEFAULT 0,
  cash_end          NUMERIC NOT NULL DEFAULT 0,
  cash_expenses     NUMERIC NOT NULL DEFAULT 0,
  cash_fines        NUMERIC NOT NULL DEFAULT 0,
  odo_start         NUMERIC NOT NULL DEFAULT 0,
  odo_end           NUMERIC NOT NULL DEFAULT 0,
  checklist_done    INTEGER NOT NULL DEFAULT 0,
  checklist_total   INTEGER NOT NULL DEFAULT 0,
  summary_text      TEXT,
  -- ключ идемпотентности: повторный POST того же завершения смены (двойной
  -- тап, ретрай на плохой связи) вернёт уже созданную смену, а не дубль
  client_request_id TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date_iso DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_driver ON shifts(driver_id);
CREATE INDEX IF NOT EXISTS idx_shifts_car ON shifts(car_id);

-- Снимок чек-листа по конкретной смене. item_text хранится копией — это и есть
-- защита истории от правок шаблона.
CREATE TABLE IF NOT EXISTS shift_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  phase         TEXT NOT NULL,
  section_title TEXT NOT NULL,
  item_text     TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  checked       BOOLEAN NOT NULL DEFAULT false,
  comment       TEXT,
  -- пути к файлам в приватном бакете Storage, не публичные ссылки
  photo_paths   TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_shift_items_shift ON shift_items(shift_id);

-- Черновик незавершённой смены: по одному на водителя. Всё состояние экрана
-- (отметки, замечания, введённые данные начала смены) лежит в JSONB — форма
-- меняется вместе с интерфейсом, миграции под каждое поле не нужны.
CREATE TABLE IF NOT EXISTS shift_drafts (
  driver_id  UUID PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ─── Автопарк: расходы, напоминания, график ─────────────────────────────── */

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id       UUID REFERENCES cars(id) ON DELETE SET NULL,
  driver_id    UUID REFERENCES drivers(id) ON DELETE SET NULL,
  shift_id     UUID REFERENCES shifts(id) ON DELETE SET NULL,
  date_iso     DATE NOT NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC NOT NULL CHECK (amount >= 0),
  comment      TEXT NOT NULL DEFAULT '',
  receipt_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_car ON expenses(car_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date_iso DESC);

CREATE TABLE IF NOT EXISTS reminders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id     UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  due_date   DATE NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);

CREATE TABLE IF NOT EXISTS assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_iso   DATE NOT NULL,
  driver_id  UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  car_id     UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  time_start TEXT NOT NULL DEFAULT '',
  time_end   TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- один водитель — одна запись в графике на дату
  UNIQUE (date_iso, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date_iso);

/* ─── Правила и тест по ТБ ───────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS rules (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title    TEXT NOT NULL,
  body     TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  active   BOOLEAN NOT NULL DEFAULT true
);

-- correct_index никогда не уходит на клиент водителя: ответы проверяет сервер
-- (иначе правильные варианты видно в исходниках страницы).
CREATE TABLE IF NOT EXISTS quiz_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  options       TEXT[] NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0),
  position      INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true
);

-- Журнал попыток: хранится каждая, допуск считается по последней.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  date_iso   DATE NOT NULL DEFAULT current_date,
  score      INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  passed     BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_driver ON quiz_attempts(driver_id, created_at DESC);

/* ─── Настройки приложения ───────────────────────────────────────────────── */

-- Пары ключ-значение: срок действия инструктажа, номер получателя сводки
-- в WhatsApp и прочее, что администратор меняет из интерфейса.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
