// Which languages the site speaks, and how to pick one. Adding a language is one
// entry in LANGUAGES: its strings come from the translation service unless a
// hand-written dictionary is registered for it in ./index.tsx.

interface Language {
  /** The language's name in itself, shown in the picker. */
  name: string;
  /** BCP 47 tag for <html lang> and Intl. */
  tag: string;
  /** Language codes at the translation services. */
  azure: string;
  libre: string;
  /** Countries (ISO 3166-1 alpha-2) whose visitors get this language first. */
  countries: readonly string[];
  /** Extra Accept-Language tags (lower case) that mean this language. */
  aliases?: readonly string[];
}

export const LANGUAGES = {
  en: { name: 'English', tag: 'en', azure: 'en', libre: 'en', countries: [] },
  zh: {
    name: '简体中文',
    tag: 'zh-CN',
    azure: 'zh-Hans',
    libre: 'zh',
    countries: ['CN', 'SG'],
    aliases: ['zh-cn', 'zh-sg', 'zh-hans'],
  },
  'zh-Hant': {
    name: '繁體中文',
    tag: 'zh-TW',
    azure: 'zh-Hant',
    libre: 'zt',
    countries: ['TW', 'HK', 'MO'],
    aliases: ['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'],
  },
  ja: { name: '日本語', tag: 'ja', azure: 'ja', libre: 'ja', countries: ['JP'] },
  ko: { name: '한국어', tag: 'ko', azure: 'ko', libre: 'ko', countries: ['KR'] },
  es: {
    name: 'Español',
    tag: 'es',
    azure: 'es',
    libre: 'es',
    countries: [
      'ES',
      'MX',
      'AR',
      'CO',
      'CL',
      'PE',
      'VE',
      'EC',
      'GT',
      'CU',
      'BO',
      'DO',
      'HN',
      'PY',
      'SV',
      'NI',
      'CR',
      'PA',
      'UY',
    ],
  },
  fr: { name: 'Français', tag: 'fr', azure: 'fr', libre: 'fr', countries: ['FR', 'MC'] },
  de: { name: 'Deutsch', tag: 'de', azure: 'de', libre: 'de', countries: ['DE', 'AT', 'LI'] },
} as const satisfies Record<string, Language>;

export type Locale = keyof typeof LANGUAGES;
export const LOCALES = Object.keys(LANGUAGES) as Locale[];

/** English is the original; everything else is a translation of it. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Name of the cookie that remembers a visitor's manual choice. */
export const LOCALE_COOKIE = 'lang';

export const isLocale = (v: unknown): v is Locale =>
  typeof v === 'string' && Object.hasOwn(LANGUAGES, v);

const BY_COUNTRY = new Map<string, Locale>(
  LOCALES.flatMap((l) => LANGUAGES[l].countries.map((c) => [c, l] as const)),
);

const BY_TAG = new Map<string, Locale>(
  LOCALES.flatMap((l) => {
    const lang: Language = LANGUAGES[l];
    return [l.toLowerCase(), ...(lang.aliases ?? [])].map((t) => [t, l] as const);
  }),
);

/** A browser language tag (`zh-TW`, `fr-CA`, `ja`) to a supported locale, if any. */
export function localeForTag(tag: string): Locale | null {
  const t = tag.toLowerCase();
  return BY_TAG.get(t) ?? BY_TAG.get(t.split('-')[0] ?? '') ?? null;
}

/** First supported language in an Accept-Language header, by q-value. */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const tags = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return { tag, q: Number.isNaN(q) ? 0 : q };
    })
    .filter((t) => t.tag && t.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const locale = localeForTag(tag);
    if (locale) return locale;
  }
  return null;
}

/** The language for a visitor's country; English for countries not listed. */
export const localeForCountry = (country: string | null | undefined): Locale | null =>
  country ? (BY_COUNTRY.get(country.toUpperCase()) ?? DEFAULT_LOCALE) : null;
