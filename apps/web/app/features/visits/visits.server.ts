// Visitor log storage in MySQL. Recording never throws and never makes a page
// wait: it runs after the response, and if the database is missing or slow
// the view simply isn't logged.
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { isPrivateIp, lookupCountry } from '~/i18n/geo.server';
import { cacheGet, cacheSet } from '~/lib/cache.server';
import { afterConnect, getDb } from '~/lib/db.server';
import { getRedis, within } from '~/lib/redis.server';
import { PAGE_SIZE, parseVisit, type Visit, type VisitFilters } from './visits';

export async function recordVisit(visit: Visit): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const country = isPrivateIp(visit.ip) ? null : await lookupCountry(visit.ip);
    await within(
      db.query(
        'INSERT INTO visits (ts, ip, country, path, ua, referrer, bot) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [new Date(visit.t), visit.ip, country, visit.path, visit.ua, visit.ref, visit.bot],
      ),
      3000,
    );
  } catch (err) {
    console.warn('[visits] record failed:', err instanceof Error ? err.message : err);
  }
}

export interface VisitRow {
  id: number;
  ts: Date;
  ip: string;
  country: string | null;
  path: string;
  ua: string;
  referrer: string;
  bot: boolean;
}

function where(f: VisitFilters): [string, unknown[]] {
  const parts: string[] = [];
  const args: unknown[] = [];
  if (!f.bots) parts.push('bot = FALSE');
  const add = (sql: string, ...values: unknown[]) => {
    parts.push(sql);
    args.push(...values);
  };
  if (f.ip) add('ip = ?', f.ip);
  if (f.country === '--') add('country IS NULL');
  else if (f.country) add('country = ?', f.country);
  if (f.path) add('path = ?', f.path);
  return [parts.length ? `WHERE ${parts.join(' AND ')}` : '', args];
}

export interface VisitPage {
  rows: VisitRow[];
  total: number;
  page: number;
  pages: number;
}

/** One page of the log, newest first. */
export async function listVisits(db: Pool, f: VisitFilters): Promise<VisitPage> {
  const [clause, args] = where(f);
  const [[count]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM visits ${clause}`,
    args,
  );
  const total = Number(count?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, ts, ip, country, path, ua, referrer, bot FROM visits ${clause}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  return {
    rows: rows.map((r) => ({ ...(r as VisitRow), id: Number(r.id), bot: !!r.bot })),
    total,
    page,
    pages,
  };
}

export interface Overview {
  views: number;
  visitors: number;
  countries: number;
  bots: number;
}

export async function overview(db: Pool): Promise<Overview> {
  const [[r]] = await db.query<RowDataPacket[]>(
    `SELECT SUM(bot = FALSE) AS views, COUNT(DISTINCT CASE WHEN bot = FALSE THEN ip END) AS visitors,
            COUNT(DISTINCT CASE WHEN bot = FALSE THEN country END) AS countries, SUM(bot) AS bots
     FROM visits`,
  );
  return {
    views: Number(r?.views ?? 0),
    visitors: Number(r?.visitors ?? 0),
    countries: Number(r?.countries ?? 0),
    bots: Number(r?.bots ?? 0),
  };
}

export interface CountryCount {
  country: string | null;
  visitors: number;
  views: number;
}

/** People per country (distinct IPs), busiest first. Crawlers left out. */
export async function countryCounts(db: Pool): Promise<CountryCount[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT country, COUNT(DISTINCT ip) AS visitors, COUNT(*) AS views FROM visits
     WHERE bot = FALSE GROUP BY country ORDER BY visitors DESC, views DESC`,
  );
  return rows.map((r) => ({
    country: (r.country as string | null) ?? null,
    visitors: Number(r.visitors),
    views: Number(r.views),
  }));
}

export interface PageCount {
  path: string;
  views: number;
  readers: number;
  last: Date;
}

/** The most-read pages. Crawlers left out. */
export async function pageCounts(db: Pool, limit = 20): Promise<PageCount[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT path, COUNT(*) AS views, COUNT(DISTINCT ip) AS readers, MAX(ts) AS last FROM visits
     WHERE bot = FALSE GROUP BY path ORDER BY views DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    path: r.path as string,
    views: Number(r.views),
    readers: Number(r.readers),
    last: r.last as Date,
  }));
}

const PUBLIC_KEY = 'visits:countries:v1';
const PUBLIC_TTL = 300;

/** Visitors per country for the public map: counts only, no addresses. Cached for 5 minutes. */
export async function publicCountryCounts(): Promise<Record<string, number>> {
  const [cached] = await cacheGet([PUBLIC_KEY]);
  if (cached) {
    try {
      return JSON.parse(cached) as Record<string, number>;
    } catch {
      // Fall through and recount.
    }
  }
  const db = await getDb();
  if (!db) return {};
  try {
    const counts: Record<string, number> = {};
    for (const c of await within(countryCounts(db), 3000)) {
      if (c.country) counts[c.country] = c.visitors;
    }
    // An empty map is likely a database still warming up; recount next time.
    if (Object.keys(counts).length)
      await cacheSet([[PUBLIC_KEY, JSON.stringify(counts)]], PUBLIC_TTL);
    return counts;
  } catch (err) {
    console.warn('[visits] country counts failed:', err instanceof Error ? err.message : err);
    return {};
  }
}

// The log lived in a Redis list before MySQL. On the first start with an empty
// table, copy it over; the list is renamed, not deleted, so nothing is lost.
const REDIS_LOG = 'visits:log';

async function importRedisLog(db: Pool) {
  const [[r]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM visits');
  if (Number(r?.n) > 0) return;
  const redis = await getRedis();
  if (!redis) return;
  const raw = await redis.lRange(REDIS_LOG, 0, -1);
  const visits = raw
    .map(parseVisit)
    .filter((v): v is Visit => v !== null)
    .reverse();
  for (let i = 0; i < visits.length; i += 500) {
    const batch = visits.slice(i, i + 500);
    await db.query('INSERT INTO visits (ts, ip, path, ua, referrer, bot) VALUES ?', [
      batch.map((v) => [new Date(v.t), v.ip, v.path, v.ua, v.ref, v.bot]),
    ]);
  }
  if (raw.length) await redis.rename(REDIS_LOG, `${REDIS_LOG}:imported`);
  console.log(`[visits] imported ${visits.length} visits from Redis`);
}

/** Looks up countries for addresses logged without one (imported rows, lookup failures). */
async function backfillCountries(db: Pool) {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT DISTINCT ip FROM visits WHERE country IS NULL AND bot = FALSE LIMIT 1000',
  );
  let filled = 0;
  for (const { ip } of rows as { ip: string }[]) {
    if (isPrivateIp(ip) || ip === 'unknown') continue;
    const country = await lookupCountry(ip);
    if (!country) continue;
    await db.query('UPDATE visits SET country = ? WHERE ip = ? AND country IS NULL', [country, ip]);
    filled++;
  }
  if (filled) console.log(`[visits] filled in countries for ${filled} addresses`);
}

afterConnect(async (db) => {
  await importRedisLog(db);
  await backfillCountries(db);
});
