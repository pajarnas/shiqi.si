// Country of a visitor, for picking a first language.
// A CDN header wins when one is present; otherwise ask a lookup service
// (country.is by default, no key needed) and cache the answer per IP.
import { cacheGet, cacheSet } from '~/lib/cache.server';
import { clientIp } from '~/features/visits/visits';

const COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country'];
const DEFAULT_URL = 'https://api.country.is/{ip}';
const TTL = 7 * 24 * 3600;
const TIMEOUT_MS = 800;

const valid = (c: unknown): c is string => typeof c === 'string' && /^[A-Z]{2}$/.test(c);

export async function visitorCountry(request: Request): Promise<string | null> {
  for (const h of COUNTRY_HEADERS) {
    const c = request.headers.get(h)?.toUpperCase();
    if (valid(c) && c !== 'XX') return c;
  }
  const ip = clientIp(request.headers);
  if (ip === 'unknown' || isPrivateIp(ip)) return null;
  return lookupCountry(ip);
}

export async function lookupCountry(ip: string): Promise<string | null> {
  const template = process.env.GEOIP_URL ?? DEFAULT_URL;
  if (template === 'off') return null;
  const key = `geo:v1:${ip}`;
  const [cached] = await cacheGet([key]);
  if (cached !== null && cached !== undefined) return cached || null;
  try {
    const res = await fetch(template.replace('{ip}', encodeURIComponent(ip)), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as Record<string, unknown>;
    const country = [body.country, body.country_code, body.countryCode]
      .map((c) => (typeof c === 'string' ? c.toUpperCase() : c))
      .find(valid);
    // Remember misses too (as ''), so an unknown IP doesn't cost a lookup per page.
    await cacheSet([[key, country ?? '']], TTL);
    return country ?? null;
  } catch (err) {
    console.warn('[geo] lookup failed', ip, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Loopback and private ranges, where a geo lookup can't say anything. */
export function isPrivateIp(ip: string): boolean {
  return (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === '::1' ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip) ||
    ip.startsWith('::ffff:127.')
  );
}
