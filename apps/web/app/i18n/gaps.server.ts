// Strings added to en.ts but not yet to a translation get filled in by the
// translation service, so a new English string never shows up untranslated
// for long. Hand-written translations always win.
import { handWritten } from './index';
import type { Locale } from './locales';
import { missingStrings, setPath } from './merge';
import { en } from './strings/en';
import { translateTexts, translationEnabled, within } from './translate.server';

const WAIT_MS = 3000;
const complete = new Map<Locale, Record<string, unknown>>();

/** Machine translations for the gaps in `locale`'s dictionary, as a sparse tree. */
export async function fillGaps(locale: Locale): Promise<Record<string, unknown> | undefined> {
  if (locale === 'en') return undefined;
  const done = complete.get(locale);
  if (done) return done;
  const missing = missingStrings(en, handWritten(locale));
  if (!missing.length) {
    complete.set(locale, {});
    return undefined;
  }
  if (!translationEnabled()) return undefined;
  const texts = missing.map((m) => m.text);
  const out = await within(
    translateTexts(texts, locale),
    WAIT_MS,
    texts.map(() => null),
  );
  const tree = {};
  missing.forEach((m, i) => {
    const t = out[i];
    if (t) setPath(tree, m.path, t);
  });
  if (out.every(Boolean)) complete.set(locale, tree);
  return tree;
}
