import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemePreference {
  if (typeof document === 'undefined') return 'auto';
  const fromDom = document.documentElement.dataset.themePref;
  return isThemePreference(fromDom) ? fromDom : 'auto';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readStored);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themePref = preference;
  }, [theme, preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPref(pref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* storage blocked: the choice lasts for this page view */
    }
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** Read CSS custom properties from <html>, refreshed whenever the theme changes. */
export function useThemeTokens<K extends string>(names: readonly K[]): Record<K, string> | null {
  const { theme } = useTheme();
  const key = names.join(',');
  const [tokens, setTokens] = useState<Record<K, string> | null>(null);
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const out = {} as Record<K, string>;
    for (const n of key.split(',') as K[]) out[n] = style.getPropertyValue(`--${n}`).trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading computed styles after paint
    setTokens(out);
  }, [theme, key]);
  return tokens;
}
