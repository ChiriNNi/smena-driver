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

async function seedRules() {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM rules');
  if (rows[0].n > 0) {
    console.log('• Правила уже заполнены — пропускаю.');
    return;
  }
  for (const [i, rule] of seed.rules.entries()) {
    await client.query('INSERT INTO rules (title, body, position) VALUES ($1, $2, $3)', [rule.title, rule.body, i]);
  }
  console.log(`• Правила: ${seed.rules.length}.`);
}

async function seedQuiz() {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM quiz_questions');
  if (rows[0].n > 0) {
    console.log('• Вопросы теста уже заполнены — пропускаю.');
    return;
  }
  for (const [i, q] of seed.quiz.entries()) {
    await client.query(
      'INSERT INTO quiz_questions (question, options, correct_index, position) VALUES ($1, $2::text[], $3, $4)',
      [q.question, q.options, q.correct, i]
    );
  }
  console.log(`• Вопросы теста: ${seed.quiz.length}.`);
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
  await seedRules();
  await seedQuiz();
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
