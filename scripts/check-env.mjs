// Проверка настроек: что записано в .env.local и работает ли это.
// Запуск: npm run check:env
//
// Значения не печатаются — только состав строки подключения (хост, порт,
// пользователь, база) и длины секретов. Дальше идут живые проверки: соединение
// с базой, наличие таблиц и доступность приватного бакета Storage.

import https from 'node:https';
import net from 'node:net';
import pg from 'pg';
import { loadEnvLocal, pgConfig } from './env.mjs';

/**
 * Доступен ли порт. Проверяем до попытки подключиться через pg: на закрытом
 * порте драйвер на Windows роняет процесс ошибкой libuv при уборке соединения,
 * и перехватить это из кода нельзя.
 */
function tcpReachable(host, port, timeout = 8000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

loadEnvLocal();

/**
 * GET через node:https, а не fetch: на Node 24 под Windows процесс падает
 * ошибкой libuv при уборке fetch-соединения на выходе, и вывод скрипта
 * заканчивается пугающим Assertion failed.
 */
function httpsGet(url, headers) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'GET', headers, timeout: 15000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: 'превышено время ожидания' });
    });
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
    req.end();
  });
}

let problems = 0;

function ok(text) {
  console.log(`  ok   ${text}`);
}

function bad(text) {
  problems += 1;
  console.log(`  ошибка   ${text}`);
}

/* ─── Состав переменных ──────────────────────────────────────────────────── */

console.log('\nПеременные окружения');

const dbUrl = process.env.DATABASE_URL ?? '';
if (!dbUrl) {
  bad('DATABASE_URL не задан');
} else {
  try {
    const u = new URL(dbUrl);
    console.log(`  DATABASE_URL: ${u.protocol}//${u.username}:<пароль ${u.password.length} симв.>@${u.host}${u.pathname}`);
    if (/\[YOUR-PASSWORD\]/i.test(dbUrl)) bad('в строке осталась заглушка [YOUR-PASSWORD]');
    else if (!u.password) bad('в строке подключения нет пароля');
    else ok('строка подключения разобрана');
    if (u.port === '6543') ok('режим transaction pooler (порт 6543) — то, что нужно для Vercel');
    else if (u.port === '5432') ok('порт 5432 (session pooler или прямое подключение)');
  } catch {
    bad('DATABASE_URL не похож на адрес подключения');
  }
}

const secret = process.env.SESSION_SECRET ?? '';
if (secret.length >= 32) ok(`SESSION_SECRET задан (${secret.length} симв.)`);
else bad(`SESSION_SECRET слишком короткий (${secret.length} симв., нужно от 32)`);

const supabaseUrl = process.env.SUPABASE_URL ?? '';
if (/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/.test(supabaseUrl)) ok(`SUPABASE_URL: ${supabaseUrl}`);
else bad(`SUPABASE_URL не задан или не похож на адрес проекта: ${supabaseUrl || '(пусто)'}`);

const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!secretKey) bad('SUPABASE_SECRET_KEY не задан — загрузка фото работать не будет');
else if (secretKey.startsWith('sb_publishable_')) bad('вместо секретного ключа записан publishable — нужен sb_secret_…');
else ok(`SUPABASE_SECRET_KEY задан (${secretKey.slice(0, 10)}…, ${secretKey.length} симв.)`);

/* ─── Живые проверки ─────────────────────────────────────────────────────── */

console.log('\nСоединение с базой');

const dbHost = (() => {
  try {
    const u = new URL(dbUrl);
    return { host: u.hostname, port: Number(u.port) || 5432 };
  } catch {
    return null;
  }
})();

const reachable = dbHost ? await tcpReachable(dbHost.host, dbHost.port) : false;
if (dbHost && !reachable) {
  bad(`${dbHost.host}:${dbHost.port} не отвечает — проверьте строку подключения (и что проект Supabase не на паузе)`);
}

if (dbUrl && !/\[YOUR-PASSWORD\]/i.test(dbUrl) && reachable) {
  const client = new pg.Client({ ...pgConfig(dbUrl), connectionTimeoutMillis: 15000 });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const { rows } = await client.query('SELECT current_database() AS db, version() AS v');
    ok(`подключение есть: база ${rows[0].db}, ${rows[0].v.split(' ').slice(0, 2).join(' ')}`);

    const tables = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
       ('drivers','cars','shifts','shift_items','checklist_sections','quiz_questions')`
    );
    if (tables.rows[0].n === 6) {
      ok('схема применена');
      const counts = await client.query(
        `SELECT (SELECT count(*) FROM drivers WHERE role = 'admin')::int AS admins,
                (SELECT count(*) FROM cars)::int AS cars,
                (SELECT count(*) FROM checklist_template_items WHERE active)::int AS items,
                (SELECT count(*) FROM quiz_questions WHERE active)::int AS quiz`
      );
      const c = counts.rows[0];
      console.log(`  данные: администраторов ${c.admins}, автомобилей ${c.cars}, пунктов чек-листа ${c.items}, вопросов теста ${c.quiz}`);
      if (c.admins === 0) console.log('  дальше: npm run db:seed — начальные данные и первый администратор');
    } else {
      console.log(`  таблиц из схемы найдено ${tables.rows[0].n} из 6`);
      console.log('  дальше: npm run db:migrate');
    }
  } catch (err) {
    if (err.code === '28P01') bad('пароль базы не подходит — сбросьте его в Supabase и запустите npm run setup:env');
    else if (err.code === 'ENOTFOUND') bad('хост из строки подключения не найден — проверьте адрес');
    else bad(`подключиться не удалось: ${err.message || err.code}`);
  } finally {
    // Закрываем только состоявшееся соединение: end() на клиенте, который
    // так и не подключился, падает на Windows ошибкой libuv.
    if (connected) await client.end().catch(() => {});
  }
} else if (!dbHost || reachable) {
  bad('проверка пропущена: строка подключения не готова');
}

console.log('\nХранилище фото');

if (supabaseUrl && secretKey) {
  const bucket = 'shift-photos';
  const res = await httpsGet(`${supabaseUrl.replace(/\/+$/, '')}/storage/v1/bucket/${bucket}`, {
    Authorization: `Bearer ${secretKey}`,
    apikey: secretKey,
  });

  if (res.status === 200) {
    ok(`бакет ${bucket} доступен`);
    let isPublic = false;
    try {
      isPublic = Boolean(JSON.parse(res.body).public);
    } catch {
      /* ответ не разобрался — публичность не проверить */
    }
    if (isPublic) bad('бакет публичный — фото повреждений откроются по прямой ссылке; снимите галочку Public');
    else ok('бакет приватный, как и требуется');
  } else if (res.status === 404) {
    bad(`бакет ${bucket} не найден — создайте его в Storage (Public не ставить)`);
  } else if (res.status === 401 || res.status === 403) {
    bad('ключ не подошёл — проверьте, что записан секретный ключ (sb_secret_…), а не publishable');
  } else if (res.status === 0) {
    bad(`обратиться к Storage не удалось: ${res.body}`);
  } else {
    bad(`Storage ответил ${res.status}`);
  }
} else {
  bad('проверка пропущена: адрес проекта или ключ не заданы');
}

console.log(problems === 0 ? '\nВсё в порядке.\n' : `\nПроблем: ${problems}.\n`);
process.exit(problems > 0 ? 1 : 0);
