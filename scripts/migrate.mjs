// Применяет lib/schema.sql к базе данных, указанной в DATABASE_URL.
// Запуск: npm run db:migrate
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadEnvLocal, pgConfig, projectRoot, requireDatabaseUrl } from './env.mjs';

loadEnvLocal();
const connectionString = requireDatabaseUrl();

const schema = readFileSync(path.join(projectRoot, 'lib', 'schema.sql'), 'utf8');
const client = new pg.Client(pgConfig(connectionString));

try {
  await client.connect();
  await client.query(schema);
  console.log('Схема БД применена успешно.');
  console.log('Дальше: npm run db:seed — начальный чек-лист, правила, тест и первый администратор.');
} catch (err) {
  console.error('Ошибка применения схемы:', err.message || err.code || err);
  if (err.code === 'ECONNREFUSED') console.error('База по адресу из DATABASE_URL не отвечает — проверьте строку подключения.');
  process.exit(1);
} finally {
  await client.end();
}
