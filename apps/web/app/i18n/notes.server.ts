// Notes are written in English. For other locales their title, summary and
// body go through the translation service; the body is translated as the HTML
// the note renders to, so any MDX works without a separate translation file.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Locale } from './locales';
import type { NoteText } from './notes';
import { translateTexts, translationEnabled, within } from './translate.server';

interface NoteLike {
  href: string;
  title: string;
  summary: string;
}

/** How long a page waits for a translation that isn't cached yet. */
const META_WAIT_MS = 4000;
const BODY_WAIT_MS = 10_000;

/** Translated title and summary per note href; notes that couldn't be translated are left out. */
export async function localizeNoteMeta(
  notes: readonly NoteLike[],
  locale: Locale,
): Promise<NoteText> {
  if (locale === 'en' || !translationEnabled() || !notes.length) return {};
  const texts = notes.flatMap((n) => [n.title, n.summary]);
  const out = await within(
    translateTexts(texts, locale),
    META_WAIT_MS,
    texts.map(() => null),
  );
  const result: NoteText = {};
  notes.forEach((n, i) => {
    const title = out[2 * i];
    const summary = out[2 * i + 1];
    if (title && summary) result[n.href] = { title, summary };
  });
  return result;
}

export type NoteBody =
  | { status: 'original' }
  | { status: 'translated'; html: string }
  | { status: 'pending' | 'unavailable' };

/** The note body in `locale`, as HTML, or why it's shown in English instead. */
export async function localizeNoteBody(
  Component: ComponentType,
  locale: Locale,
): Promise<NoteBody> {
  if (locale === 'en') return { status: 'original' };
  if (!translationEnabled()) return { status: 'unavailable' };
  const html = renderToStaticMarkup(createElement(Component));
  const pending = Symbol('pending');
  const out = await within<(string | null)[] | typeof pending>(
    translateTexts([html], locale, 'html'),
    BODY_WAIT_MS,
    pending,
  );
  if (out === pending) return { status: 'pending' };
  const translated = out[0];
  return translated
    ? { status: 'translated', html: sanitize(translated) }
    : { status: 'unavailable' };
}

/** Drop anything executable the model might have produced. The input is our own HTML. */
export function sanitize(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}
