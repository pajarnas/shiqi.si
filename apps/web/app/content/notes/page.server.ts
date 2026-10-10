// Loader data for a page that shows one note, in the visitor's language.
import { data } from 'react-router';
import { stringsFor } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteBody, localizeNoteMeta, type NoteBody } from '~/i18n/notes.server';
import type { Note } from './index';

export async function notePageData(request: Request, note: Note | undefined) {
  const { locale } = await resolveLocale(request);
  if (!note) throw data(null, { status: 404, statusText: stringsFor(locale).notes.missing });
  const original = new URL(request.url).searchParams.has('original');
  const target = original ? 'en' : locale;
  const [text, body] = await Promise.all([
    localizeNoteMeta([note], target),
    localizeNoteBody(note.Component, target),
  ]);
  const translated = body.status === 'translated';
  return {
    folder: note.folder,
    slug: note.slug,
    title: (translated && text[note.href]?.title) || note.title,
    summary: (translated && text[note.href]?.summary) || note.summary,
    body: body as NoteBody,
    // Offer the other version when this visitor would normally read a translation.
    canSwitch: locale !== 'en',
  };
}

export type NotePageData = Awaited<ReturnType<typeof notePageData>>;
