// Which language to serve a request in:
// 1. ?lang=xx in the URL (shareable links), 2. the visitor's saved choice (cookie),
// 3. the country their IP is in, 4. their browser's Accept-Language, 5. English.
import { visitorCountry } from './geo.server';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeForCountry,
  localeFromAcceptLanguage,
  type Locale,
} from './locales';

export type LocaleSource = 'query' | 'cookie' | 'ip' | 'header' | 'default';

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function resolveLocale(
  request: Request,
): Promise<{ locale: Locale; source: LocaleSource }> {
  const query = new URL(request.url).searchParams.get('lang');
  if (isLocale(query)) return { locale: query, source: 'query' };
  const cookie = readCookie(request, LOCALE_COOKIE);
  if (isLocale(cookie)) return { locale: cookie, source: 'cookie' };
  const byIp = localeForCountry(await visitorCountry(request));
  if (byIp) return { locale: byIp, source: 'ip' };
  const byHeader = localeFromAcceptLanguage(request.headers.get('accept-language'));
  if (byHeader) return { locale: byHeader, source: 'header' };
  return { locale: DEFAULT_LOCALE, source: 'default' };
}

/** Set-Cookie value that remembers a manual choice for a year. */
export const localeCookie = (locale: Locale) =>
  `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
