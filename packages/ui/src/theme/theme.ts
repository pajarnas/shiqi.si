// Theme preference: stored in localStorage, applied as <html data-theme>.
// "auto" follows the OS between day and night.

// Display names live in UI_STRINGS.themes, keyed by id.
export const THEMES = [
  { id: 'auto' },
  { id: 'day' },
  { id: 'night' },
  { id: 'gold' },
  { id: 'matcha' },
] as const;

export type ThemePreference = (typeof THEMES)[number]['id'];
export type ResolvedTheme = Exclude<ThemePreference, 'auto'>;

export const THEME_STORAGE_KEY = 'shiqi:theme';

export function isThemePreference(v: unknown): v is ThemePreference {
  return THEMES.some((t) => t.id === v);
}

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (pref !== 'auto') return pref;
  return prefersDark ? 'night' : 'day';
}

/**
 * Inline this in <head> before any CSS paints, so the first frame already has
 * the right theme (no flash). Kept dependency-free and tiny on purpose.
 */
export const themeScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var p=localStorage.getItem(k)||'auto';var d=matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='auto'?(d?'night':'day'):p;document.documentElement.dataset.theme=t;document.documentElement.dataset.themePref=p;}catch(e){document.documentElement.dataset.theme='day';}})();`;
