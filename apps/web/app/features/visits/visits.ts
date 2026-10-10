// Visitor log: what one page view looks like, and the pure helpers around it.
// Reading and writing the database lives in visits.server.ts.
import { isbot } from 'isbot';

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

/** Rows per page on the admin log. */
export const PAGE_SIZE = 50;

export interface VisitFilters {
  ip: string;
  country: string;
  path: string;
  bots: boolean;
  page: number;
}

/** Reads admin filters from a query string, ignoring anything malformed. */
export function parseFilters(params: URLSearchParams): VisitFilters {
  const country = (params.get('country') ?? '').toUpperCase();
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    ip: (params.get('ip') ?? '').slice(0, 45),
    country: /^[A-Z]{2}$|^--$/.test(country) ? country : '',
    path: (params.get('path') ?? '').slice(0, 255),
    bots: params.get('bots') === '1',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100_000) : 1,
  };
}

/** Builds a query string from filters, leaving defaults out. */
export function filterQuery(f: Partial<VisitFilters>): string {
  const q = new URLSearchParams();
  if (f.ip) q.set('ip', f.ip);
  if (f.country) q.set('country', f.country);
  if (f.path) q.set('path', f.path);
  if (f.bots) q.set('bots', '1');
  if (f.page && f.page > 1) q.set('page', String(f.page));
  const s = q.toString();
  return s ? `?${s}` : '?';
}

/** Page numbers to show around the current one, with null for a gap. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out: (number | null)[] = [];
  let last = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - last > 1) out.push(null);
    out.push(n);
    last = n;
  }
  return out;
}

/** Regional-indicator flag for an ISO country code; a globe when unknown. */
export function flag(country: string | null): string {
  if (!country || !/^[A-Z]{2}$/.test(country)) return '🌐';
  return String.fromCodePoint(...[...country].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung'],
  [/MicroMessenger\//, 'WeChat'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
  [/curl\//, 'curl'],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

/** "Chrome · macOS" from a user agent; the first word of it when unrecognized. */
export function shortAgent(ua: string): string {
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  const parts = [browser, system].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return ua.split(/[\s/;(]/)[0]?.slice(0, 30) || '—';
}
