// The site's words come from here: useI18n() gives the current locale and its
// dictionary, already merged over English.
import { UiStringsProvider, format } from '@shiqi/ui';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LANGUAGES, type Locale } from './locales';
import { deepMerge } from './merge';
import { en, type Strings } from './strings/en';
import { zh } from './strings/zh';

export { format };
export * from './locales';
export type { Strings };

/** Hand-written translations, by locale. The rest come from the translation service. */
const DICTIONARIES: Partial<Record<Locale, unknown>> = { zh };

/**
 * The full dictionary for a locale: English, then the hand-written translation,
 * then `extra` (strings the translation service filled in) on top of gaps.
 */
export function stringsFor(locale: Locale, extra?: unknown): Strings {
  return deepMerge(deepMerge(en, extra), DICTIONARIES[locale]);
}

/** The hand-written part only, for finding gaps. */
export const handWritten = (locale: Locale) => DICTIONARIES[locale] ?? {};

interface I18n {
  locale: Locale;
  lang: string;
  t: Strings;
}

const I18nContext = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  lang: LANGUAGES[DEFAULT_LOCALE].tag,
  t: en,
});

export function I18nProvider({
  locale,
  extra,
  children,
}: {
  locale: Locale;
  extra?: unknown;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, lang: LANGUAGES[locale].tag, t: stringsFor(locale, extra) }),
    [locale, extra],
  );
  return (
    <I18nContext.Provider value={value}>
      <UiStringsProvider strings={value.t.ui}>{children}</UiStringsProvider>
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
