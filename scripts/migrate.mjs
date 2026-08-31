// Применяет lib/schema.sql к базе данных, указанной в DATABASE_URL.
// Запуск: npm run db:migrate
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Простая загрузка .env.local без внешних зависимостей.
function loadEnvLocal() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local может отсутствовать — тогда переменные должны быть заданы иначе
  }
}

loadEnvLocal();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL не задан. Создайте .env.local на основе .env.example.');
  process.exit(1);
}

const schema = readFileSync(path.join(__dirname, '..', 'lib', 'schema.sql'), 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(schema);
  console.log('Схема БД применена успешно.');
} catch (err) {
  console.error('Ошибка применения схемы:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
