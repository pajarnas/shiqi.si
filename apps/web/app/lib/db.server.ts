// One shared MySQL pool for the server, opened on first use and migrated
// before it is handed out. Resolves to null when no database is configured or
// it can't be reached, so callers fall back instead of failing the page; the
// next call tries again.
import { createPool, type Pool } from 'mysql2/promise';
import { within } from './redis.server';

/** Schema changes, applied in order and recorded in schema_migrations. Never edit one that shipped; add a new one. */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE visits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME(3) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    country CHAR(2) NULL,
    path VARCHAR(255) NOT NULL,
    ua VARCHAR(300) NOT NULL DEFAULT '',
    referrer VARCHAR(255) NOT NULL DEFAULT '',
    bot BOOLEAN NOT NULL DEFAULT FALSE,
    KEY visits_ts (ts),
    KEY visits_path_ts (path, ts),
    KEY visits_ip_ts (ip, ts),
    KEY visits_country (country)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function migrate(pool: Pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT UNSIGNED PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  );
  const [rows] = await pool.query('SELECT version FROM schema_migrations');
  const done = new Set((rows as { version: number }[]).map((r) => r.version));
  for (const [i, sql] of MIGRATIONS.entries()) {
    const version = i + 1;
    if (done.has(version)) continue;
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
    console.log(`[db] applied migration ${version}`);
  }
}

let pool: Promise<Pool | null> | undefined;
/** After a failed connect, wait this long before trying again. */
const RETRY_MS = 15_000;
let failedAt = 0;
const onReady: ((pool: Pool) => Promise<void>)[] = [];

/** Runs `task` once, right after the database first becomes available. */
export function afterConnect(task: (pool: Pool) => Promise<void>) {
  onReady.push(task);
}

/**
 * MYSQL_URL when set; otherwise built from MYSQL_HOST, MYSQL_PASSWORD and
 * optional MYSQL_USER / MYSQL_DATABASE / MYSQL_PORT. On the server the password
 * comes from secrets.env (GitHub Secret APP_MYSQL_PASSWORD), the rest from compose.
 */
export function mysqlUrl(env: Record<string, string | undefined> = process.env): string | null {
  if (env.MYSQL_URL) return env.MYSQL_URL;
  const { MYSQL_HOST: host, MYSQL_PASSWORD: password } = env;
  if (!host || !password) return null;
  const user = encodeURIComponent(env.MYSQL_USER ?? 'shiqi');
  const db = encodeURIComponent(env.MYSQL_DATABASE ?? 'shiqi');
  return `mysql://${user}:${encodeURIComponent(password)}@${host}:${env.MYSQL_PORT ?? 3306}/${db}`;
}

export function getDb(): Promise<Pool | null> {
  const url = mysqlUrl();
  if (!url || Date.now() - failedAt < RETRY_MS) return Promise.resolve(null);
  pool ??= (async () => {
    const p = createPool({
      uri: url,
      connectionLimit: 5,
      connectTimeout: 2000,
      timezone: 'Z',
      supportBigNumbers: true,
    });
    try {
      await within(migrate(p), 10_000);
      for (const task of onReady) {
        task(p).catch((err: unknown) => console.warn('[db] startup task failed:', err));
      }
      return p;
    } catch (err) {
      console.warn('[db] unavailable:', err instanceof Error ? err.message : err);
      p.end().catch(() => {});
      pool = undefined;
      failedAt = Date.now();
      return null;
    }
  })();
  return pool;
}
