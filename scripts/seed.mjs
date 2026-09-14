// Первичное заполнение базы: чек-лист, правила, вопросы теста и первый
// администратор. Запуск: npm run db:seed
//
// Скрипт идемпотентный — повторный запуск ничего не дублирует: справочники
// заполняются только если пусты, администратор создаётся только если такого
// номера ещё нет.
//
// Почему администратор создаётся командой, а не формой регистрации: форма
// «создать первого админа» на публичном адресе — это открытая дверь, если
// кто-то откроет её раньше вас. Здесь для создания нужен доступ к серверу
// и переменным окружения.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { loadEnvLocal, pgConfig, projectRoot, requireDatabaseUrl } from './env.mjs';

loadEnvLocal();
const connectionString = requireDatabaseUrl();

const seed = JSON.parse(readFileSync(path.join(projectRoot, 'lib', 'seed-data.json'), 'utf8'));

const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

function normalizePhone(raw) {
  const d = onlyDigits(raw).replace(/^8/, '7');
  return /^7\d{10}$/.test(d) ? d : null;
}

const client = new pg.Client(pgConfig(connectionString));

async function seedChecklist() {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM checklist_sections');
  if (rows[0].n > 0) {
    console.log('• Чек-лист уже заполнен — пропускаю.');
    return;
  }

  let sections = 0;
  let items = 0;
  for (const phase of seed.checklist) {
    for (const [sectionIndex, section] of phase.sections.entries()) {
      const res = await client.query(
        `INSERT INTO checklist_sections (phase, title, slug, notable, position)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [phase.id, section.title, section.id, Boolean(section.notable), sectionIndex]
      );
      const sectionId = res.rows[0].id;
      sections += 1;

      for (const [itemIndex, item] of section.items.entries()) {
        await client.query(
          'INSERT INTO checklist_template_items (section_id, text, qty, position) VALUES ($1, $2, $3, $4)',
          [sectionId, item.text, item.qty ?? null, itemIndex]
        );
        items += 1;
      }
    }
  }
  console.log(`• Чек-лист: ${sections} разделов, ${items} пунктов.`);
}

/**
 * Версия начального наполнения. Регламенты и вопросы обновляются, когда версия
 * в базе меньше этой: иначе демо-набор из первой установки так и остался бы
 * вместо настоящих правил компании.
 */
const CONTENT_VERSION = 2;

async function currentContentVersion() {
  const { rows } = await client.query("SELECT value FROM app_settings WHERE key = 'content_version'");
  return Number(rows[0]?.value ?? 0);
}

async function seedRegulations(replace) {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM rules');
  if (rows[0].n > 0 && !replace) {
    console.log('• Регламенты уже заполнены — пропускаю.');
    return;
  }
  // Регламенты ни на что не ссылаются, поэтому при обновлении заменяются целиком.
  if (replace) await client.query('DELETE FROM rules');

  for (const [i, block] of seed.regulations.entries()) {
    await client.query(
      'INSERT INTO rules (kind, title, subtitle, points, position) VALUES ($1, $2, $3, $4::text[], $5)',
      [block.kind, block.title, block.subtitle ?? '', block.points, i]
    );
  }
  const duties = seed.regulations.filter((r) => r.kind === 'duty').length;
  const points = seed.regulations.reduce((a, r) => a + r.points.length, 0);
  console.log(`• Регламенты: ${duties} блоков обязанностей и ${seed.regulations.length - duties} правил, ${points} пунктов.`);
}

async function seedQuiz(replace) {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM quiz_questions WHERE active');
  if (rows[0].n > 0 && !replace) {
    console.log('• Вопросы теста уже заполнены — пропускаю.');
    return;
  }
  // Старые вопросы не удаляем, а выводим из оборота: на них ссылаются
  // сохранённые попытки, и сводка по ним должна остаться читаемой.
  if (replace) await client.query('UPDATE quiz_questions SET active = false');

  for (const [i, q] of seed.quiz.entries()) {
    await client.query(
      'INSERT INTO quiz_questions (question, options, correct_index, topic, position) VALUES ($1, $2::text[], $3, $4, $5)',
      [q.question, q.options, q.correct, q.topic ?? '', i]
    );
  }
  console.log(`• Вопросы теста: ${seed.quiz.length} (тем: ${new Set(seed.quiz.map((q) => q.topic)).size}).`);
}

async function seedAdmin() {
  const phone = normalizePhone(process.env.ADMIN_PHONE);
  if (!phone) {
    console.log('• Администратор не создан: задайте ADMIN_PHONE (например ADMIN_PHONE=+77075559011).');
    return;
  }

  const lastName = (process.env.ADMIN_LAST_NAME || 'Администратор').trim();
  const firstName = (process.env.ADMIN_FIRST_NAME || 'Smena').trim();
  // PIN по умолчанию — последние 4 цифры номера, как и у водителей.
  const pin = onlyDigits(process.env.ADMIN_PIN) || phone.slice(-4);
  if (!/^\d{4}$/.test(pin)) {
    console.error('ADMIN_PIN должен состоять из 4 цифр.');
    process.exit(1);
  }

  const existing = await client.query('SELECT id, role FROM drivers WHERE phone_digits = $1', [phone]);
  if (existing.rows.length > 0) {
    console.log(`• Номер ${phone} уже зарегистрирован (роль: ${existing.rows[0].role}) — пропускаю.`);
    return;
  }

  await client.query(
    `INSERT INTO drivers (last_name, first_name, phone_digits, pin_hash, role)
     VALUES ($1, $2, $3, $4, 'admin')`,
    [lastName, firstName, phone, await bcrypt.hash(pin, 10)]
  );
  console.log(`• Администратор создан: ${lastName} ${firstName}, вход по номеру ${phone}, PIN ${pin}.`);
  console.log('  Смените PIN после первого входа.');
}

try {
  await client.connect();
  await seedChecklist();

  // Обновление содержимого: при переходе на новую версию регламенты и вопросы
  // заменяются на актуальные, при равной — только дозаполняются пустые таблицы.
  // Базы, наполненные до появления версий, помечены нулём — их содержимое
  // тоже нужно обновить, иначе там навсегда останется демо-набор.
  const version = await currentContentVersion();
  const replace = version < CONTENT_VERSION;
  if (replace && version > 0) console.log(`• Обновляю регламенты и вопросы (версия ${version} → ${CONTENT_VERSION}).`);

  await seedRegulations(replace);
  await seedQuiz(replace);
  await client.query(
    `INSERT INTO app_settings (key, value) VALUES ('content_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [String(CONTENT_VERSION)]
  );

  await seedAdmin();
  console.log('Готово.');
} catch (err) {
  if (err.code === '42P01') {
    console.error('Таблиц ещё нет. Сначала выполните: npm run db:migrate');
  } else {
    console.error('Ошибка заполнения:', err.message || err.code || err);
    if (err.code === 'ECONNREFUSED') console.error('База по адресу из DATABASE_URL не отвечает — проверьте строку подключения.');
  }
  process.exit(1);
} finally {
  await client.end();
}
