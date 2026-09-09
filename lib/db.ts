import { Pool, types, type QueryResultRow } from 'pg';

// node-postgres по умолчанию парсит колонки типа DATE (OID 1082) в JS Date (в UTC-полночь),
// из-за чего при сериализации в JSON дата "съезжает" на день назад в отрицательных часовых
// поясах и превращается в полную ISO-строку с временем вместо ожидаемого 'YYYY-MM-DD'.
// Отключаем парсинг — возвращаем как есть, строкой 'YYYY-MM-DD'.
types.setTypeParser(1082, (val) => val);

// Единый пул подключений к Postgres (Neon / Vercel Postgres).
// DATABASE_URL задаётся в .env.local (локально) и в переменных окружения проекта на Vercel.
/**
 * Нужен ли TLS. Supabase и другие облачные базы принимают только защищённые
 * соединения, а локальная база в контейнере обычно поднята без TLS — попытка
 * подключиться к ней по SSL падает с «server does not support SSL».
 */
export function needsSsl(connectionString: string): boolean {
  if (/sslmode=disable/.test(connectionString)) return false;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
}

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL не задан. Укажите строку подключения к Postgres в .env.local (см. .env.example).'
      );
    }
    pool = new Pool({
      connectionString,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Выполняет функцию внутри одной транзакции на выделенном клиенте пула.
 * Используется для операций, которые должны либо полностью примениться, либо не примениться вовсе
 * (например, завершение смены: история + пробег + расходы + график записываются атомарно).
 */
export async function withTransaction<T>(
  fn: (client: { query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]> }) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const wrapped = {
      query: async <R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => {
        const res = await client.query<R>(text, params);
        return res.rows;
      },
    };
    const result = await fn(wrapped);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
