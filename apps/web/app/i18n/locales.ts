// Which languages the site speaks, and how to pick one.

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

/** English is the original; everything else is a translation of it. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Name of the cookie that remembers a visitor's manual choice. */
export const LOCALE_COOKIE = 'lang';

/** BCP 47 tags for <html lang> and Intl. */
export const HTML_LANG: Record<Locale, string> = { en: 'en', zh: 'zh-CN' };

/** Visitors from these countries (ISO 3166-1 alpha-2) get Chinese first. */
export const CHINESE_COUNTRIES = new Set(['CN', 'TW', 'HK', 'MO', 'SG']);

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** First supported language in an Accept-Language header, ignoring q-order subtleties. */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const tags = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return { tag: tag.toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((t) => t.tag && t.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return null;
}

export const localeForCountry = (country: string | null | undefined): Locale | null =>
  country ? (CHINESE_COUNTRIES.has(country.toUpperCase()) ? 'zh' : 'en') : null;
