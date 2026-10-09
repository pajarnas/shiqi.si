// Every word @shiqi/ui shows on its own. English is the default; apps pass
// their own translation through <UiStringsProvider>.
import { createContext, useContext, type ReactNode } from 'react';

export const UI_STRINGS = {
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed. Please select the text by hand.',
  mainNav: 'Main navigation',
  theme: 'Theme',
  themes: {
    auto: 'Match system',
    day: 'Day',
    night: 'Night',
    gold: '1984 Gold',
    matcha: 'Matcha',
  },
  quiz: {
    title: 'Quiz',
    score: '{score} / {total} correct',
    perfect: ' Perfect score!',
    retry: 'Try again',
    check: 'Check answer',
    next: 'Next question',
    results: 'See results',
  },
};

export type UiStrings = typeof UI_STRINGS;

const UiStringsContext = createContext<UiStrings>(UI_STRINGS);

export function UiStringsProvider({
  strings,
  children,
}: {
  strings: UiStrings;
  children: ReactNode;
}) {
  return <UiStringsContext.Provider value={strings}>{children}</UiStringsContext.Provider>;
}

export const useUiStrings = () => useContext(UiStringsContext);

/** Fill `{name}` placeholders: format('{n} items', { n: 3 }). Unknown names stay as is. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
