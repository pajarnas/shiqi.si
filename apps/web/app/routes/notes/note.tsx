import { Callout, Window } from '@shiqi/ui';
import { Link, data } from 'react-router';
import { findNote } from '~/content/notes';
import { format, stringsFor, useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteBody, localizeNoteMeta, type NoteBody } from '~/i18n/notes.server';
import { metaStrings } from '~/i18n/root-data';
import type { Route } from './+types/note';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  const note = findNote(params.slug);
  if (!note) throw data(null, { status: 404, statusText: stringsFor(locale).notes.missing });
  const original = new URL(request.url).searchParams.has('original');
  const target = original ? 'en' : locale;
  const [text, body] = await Promise.all([
    localizeNoteMeta([note], target),
    localizeNoteBody(note.Component, target),
  ]);
  const translated = body.status === 'translated';
  return {
    slug: note.slug,
    title: (translated && text[note.slug]?.title) || note.title,
    summary: (translated && text[note.slug]?.summary) || note.summary,
    body: body as NoteBody,
    // Offer the other version when this visitor would normally read a translation.
    canSwitch: locale !== 'en',
  };
}

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  const t = metaStrings(matches);
  return loaderData
    ? [
        { title: format(t.site.pageTitle, { title: loaderData.title }) },
        { name: 'description', content: loaderData.summary },
      ]
    : [{ title: format(t.site.pageTitle, { title: t.notes.missing }) }];
};

export default function NotePage({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  const note = findNote(loaderData.slug);
  if (!note) return null;
  const { Component } = note;
  const { body } = loaderData;
  return (
    <Window title={`notes/${note.slug}.mdx`}>
      <article className="prose">
        <p className="prose__meta ui-pixel">
          <Link to="/notes">{t.notes.back}</Link> · <time dateTime={note.date}>{note.date}</time>
        </p>
        <h1 lang={body.status === 'translated' ? undefined : 'en'}>{loaderData.title}</h1>
        {loaderData.canSwitch && (
          <Callout>
            {body.status === 'translated' && (
              <>
                {t.notes.machine} <Link to="?original">{t.notes.original}</Link>
              </>
            )}
            {body.status === 'original' && <Link to=".">{t.notes.translated}</Link>}
            {body.status === 'pending' && t.notes.pending}
            {body.status === 'unavailable' && t.notes.unavailable}
          </Callout>
        )}
        {body.status === 'translated' ? (
          <div dangerouslySetInnerHTML={{ __html: body.html }} />
        ) : (
          <div lang="en">
            <Component />
          </div>
        )}
      </article>
    </Window>
  );
}
