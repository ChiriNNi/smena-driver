// Заполнение .env.local: спрашивает значения в терминале и пишет их в файл.
// Запуск: npm run setup:env
//
// Смысл скрипта — чтобы строка подключения и секретный ключ попали из буфера
// обмена прямо в файл, не проходя через переписку, историю команд и логи.
// Ввод не отображается на экране, записанные значения скрипт тоже не печатает.
//
// SESSION_SECRET генерируется здесь же — это просто случайная строка, её
// неоткуда брать.

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { projectRoot } from './env.mjs';

const ENV_PATH = path.join(projectRoot, '.env.local');

let hideInput = false;

// Ввод из терминала читаем по одному вопросу. При перенаправленном вводе
// (проверка скрипта, запуск из другой программы) забираем весь поток сразу и
// отвечаем из очереди строк: readline в режиме не-терминала между вопросами
// теряет уже прочитанные данные.
const isTty = Boolean(process.stdin.isTTY);

let rl = null;
let piped = null;

if (isTty) {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Печатаем только само приглашение: пока строка пустая — это вывод вопроса,
  // дальше идёт эхо набираемых символов, и его гасим.
  rl._writeToOutput = (chunk) => {
    if (!hideInput || rl.line.length === 0) rl.output.write(chunk);
  };
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  piped = Buffer.concat(chunks).toString('utf8').split('\n');
}

/** Спрашивает значение; при hidden введённое не отображается в терминале. */
function ask(question, { hidden = false } = {}) {
  if (!isTty) {
    process.stdout.write(question + '\n');
    return Promise.resolve((piped.shift() ?? '').trim());
  }
  return new Promise((resolve) => {
    hideInput = hidden;
    rl.question(question, (answer) => {
      if (hideInput) rl.output.write('\n');
      hideInput = false;
      resolve(answer.trim());
    });
  });
}

function readExisting() {
  const values = new Map();
  try {
    for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m) values.set(m[1], m[2].trim().replace(/^['"]|['"]$/g, ''));
    }
  } catch {
    // файла ещё нет — заполняем с нуля
  }
  return values;
}

const PASSWORD_PLACEHOLDER = /\[YOUR-PASSWORD\]|\[PASSWORD\]|<password>/i;

/**
 * Supabase выдаёт строку подключения с заглушкой вместо пароля. Вклеивать
 * пароль в середину строки руками неудобно и легко испортить, поэтому
 * спрашиваем его отдельно и подставляем сами.
 */
async function fillPassword(url) {
  if (!PASSWORD_PLACEHOLDER.test(url)) return url;

  console.log('  В строке заглушка вместо пароля — введите пароль базы отдельно.');
  console.log('  Если пароль неизвестен: Supabase → Settings → Database → Reset database password.');

  for (;;) {
    const password = await ask('  Пароль базы: ', { hidden: true });
    if (!password) {
      console.log('  Пароль обязателен.');
      continue;
    }
    // Пароли Supabase содержат символы, которые в адресе значат другое
    // (@ / : ? #), поэтому кодируем — иначе строка подключения разъедется.
    return url.replace(PASSWORD_PLACEHOLDER, encodeURIComponent(password));
  }
}

const FIELDS = [
  {
    key: 'DATABASE_URL',
    title: 'Строка подключения к базе',
    hint: 'Supabase → Connect → Direct → Transaction pooler (порт 6543)',
    hidden: true,
    prepare: fillPassword,
    check(value) {
      if (!/^postgres(ql)?:\/\//.test(value)) return 'Должна начинаться с postgres:// или postgresql://';
      if (PASSWORD_PLACEHOLDER.test(value)) return 'Пароль так и не подставлен.';
      return null;
    },
  },
  {
    key: 'SUPABASE_URL',
    title: 'Адрес проекта Supabase',
    hint: 'Supabase → Connect → Server → SUPABASE_URL',
    hidden: false,
    check: (value) =>
      /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/.test(value) ? null : 'Ожидается https://<проект>.supabase.co',
  },
  {
    key: 'SUPABASE_SECRET_KEY',
    title: 'Секретный ключ проекта',
    hint: 'Supabase → Connect → Server → SUPABASE_SECRET_KEY (значение sb_secret_…)',
    hidden: true,
    check: (value) => (value.length >= 20 ? null : 'Слишком короткий — похоже, скопировалось не всё'),
  },
];

const existing = readExisting();
const values = new Map(existing);

console.log('\nЗаполнение .env.local. Вводимые значения не отображаются.');
console.log('Enter без ввода — оставить то, что уже записано.\n');

for (const field of FIELDS) {
  const has = Boolean(existing.get(field.key));
  console.log(field.title);
  console.log(`  ${field.hint}`);

  for (;;) {
    const answer = await ask(`  ${field.key}${has ? ' (уже задано, Enter — оставить)' : ''}: `, {
      hidden: field.hidden,
    });

    if (!answer) {
      if (has) break;
      console.log('  Значение обязательно.\n');
      continue;
    }

    const prepared = field.prepare ? await field.prepare(answer) : answer;

    const error = field.check(prepared);
    if (error) {
      console.log(`  ${error}\n`);
      continue;
    }

    values.set(field.key, prepared);
    break;
  }
  console.log('');
}

rl?.close();

// Секрет подписи сессий: если его нет или он слишком короткий — генерируем.
if ((values.get('SESSION_SECRET') ?? '').length < 32) {
  values.set('SESSION_SECRET', randomBytes(32).toString('hex'));
  console.log('SESSION_SECRET сгенерирован.\n');
}

const HEADER = `# Локальные настройки Smena. В git не попадает (.gitignore: .env*).
# Заполняется командой: npm run setup:env
# Описание переменных — в .env.example.
`;

const ORDER = ['DATABASE_URL', 'SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
const lines = [HEADER];
for (const key of ORDER) {
  if (values.has(key)) lines.push(`${key}=${values.get(key)}`);
}
// Остальное, что было в файле (например ADMIN_PHONE), сохраняем как есть.
for (const [key, value] of values) {
  if (!ORDER.includes(key)) lines.push(`${key}=${value}`);
}

writeFileSync(ENV_PATH, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });

console.log('Записано в .env.local:');
for (const [key, value] of values) {
  console.log(`  ${key} — ${value ? 'задано' : 'пусто'}`);
}
console.log('\nДальше: npm run db:migrate, затем npm run db:seed');
