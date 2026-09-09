// Загрузка .env.local без внешних зависимостей — используется скриптами
// миграции и первичного заполнения базы (в самом приложении переменные
// окружения читает Next.js).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.join(scriptsDir, '..');

export function loadEnvLocal() {
  try {
    const content = readFileSync(path.join(projectRoot, '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Переменная, заданная в окружении, приоритетнее файла — так удобно
      // выполнять миграцию на продакшн-базу одной командой.
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {
    // .env.local может отсутствовать — значит переменные заданы иначе
  }
}

export function requireDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL не задан. Создайте .env.local на основе .env.example.');
    process.exit(1);
  }
  return connectionString;
}

// Та же логика, что в lib/db.ts (needsSsl): облачные базы требуют TLS,
// локальная база в контейнере его обычно не поддерживает. Скрипты запускаются
// обычным node и импортировать TypeScript не могут, отсюда повтор трёх строк.
export function pgConfig(connectionString) {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  const ssl = !/sslmode=disable/.test(connectionString) && !local;
  return { connectionString, ssl: ssl ? { rejectUnauthorized: false } : false };
}
