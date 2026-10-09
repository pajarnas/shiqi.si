// Visitor log: what one page view looks like, and the pure helpers around it.
// Reading and writing Redis lives in visits.server.ts.
import { isbot } from 'isbot';

/** Entries kept in the log; older ones fall off. About 300 bytes each. */
export const LOG_SIZE = 20_000;

export interface Visit {
  /** Epoch milliseconds. */
  t: number;
  ip: string;
  /** Normalized page path, e.g. /notes/one-pixel. */
  path: string;
  ua: string;
  /** Referrer origin + path, or '' for direct visits. */
  ref: string;
  bot: boolean;
}

/** Paths that are not pages a person reads. */
const IGNORED =
  /^\/(?:api|admin|assets|fonts)(?:\/|$)|^\/(?:sitemap\.xml|robots\.txt|favicon\.svg)$/;

/**
 * Turns a request path into the page path to record, or null to skip it.
 * React Router fetches data for client navigations from `<path>.data`
 * (`/_root.data` for the home page), so those map back to the page.
 */
export function pagePath(pathname: string): string | null {
  let path = pathname;
  if (path === '/_root.data') path = '/';
  else if (path.endsWith('.data')) path = path.slice(0, -'.data'.length);
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (!path.startsWith('/') || path.length > 200 || IGNORED.test(path)) return null;
  return path;
}

/**
 * The visitor's address. In production Caddy is the only way in and it sets
 * X-Forwarded-For itself, discarding whatever the client sent, so the last
 * entry is the address Caddy saw.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const last = forwarded?.split(',').pop()?.trim();
  return last || headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Keeps the referrer short and drops query strings, which can carry tokens. */
export function shortReferrer(referrer: string | null): string {
  if (!referrer) return '';
  try {
    const url = new URL(referrer);
    return (url.origin + url.pathname).slice(0, 200);
  } catch {
    return '';
  }
}

export function makeVisit(
  headers: Headers,
  path: string,
  referrer: string | null,
  now = Date.now(),
): Visit {
  const ua = (headers.get('user-agent') ?? '').slice(0, 300);
  return {
    t: now,
    ip: clientIp(headers),
    path,
    ua,
    ref: shortReferrer(referrer),
    bot: isbot(ua),
  };
}

export function parseVisit(raw: string): Visit | null {
  try {
    const v = JSON.parse(raw) as Partial<Visit>;
    if (typeof v.t !== 'number' || typeof v.ip !== 'string' || typeof v.path !== 'string') {
      return null;
    }
    return { t: v.t, ip: v.ip, path: v.path, ua: v.ua ?? '', ref: v.ref ?? '', bot: !!v.bot };
  } catch {
    return null;
  }
}

export interface PageSummary {
  path: string;
  /** Views recorded since the log began (all time). */
  total: number;
  /** Views in the kept log window, people only. */
  views: number;
  /** Distinct addresses in the kept log window, people only. */
  readers: string[];
  last: number;
}

/** Groups the log by page, busiest first. Bots are left out of views and readers. */
export function summarize(visits: readonly Visit[], totals: Record<string, string>): PageSummary[] {
  const pages = new Map<string, PageSummary>();
  const page = (path: string) => {
    let p = pages.get(path);
    if (!p) {
      p = { path, total: Number(totals[path] ?? 0), views: 0, readers: [], last: 0 };
      pages.set(path, p);
    }
    return p;
  };
  for (const path of Object.keys(totals)) page(path);
  for (const v of visits) {
    if (v.bot) continue;
    const p = page(v.path);
    p.views += 1;
    if (!p.readers.includes(v.ip)) p.readers.push(v.ip);
    p.last = Math.max(p.last, v.t);
  }
  return [...pages.values()].sort((a, b) => b.total - a.total || a.path.localeCompare(b.path));
}
