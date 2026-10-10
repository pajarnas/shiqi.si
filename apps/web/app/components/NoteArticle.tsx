import { Callout, useIslands, Window } from '@shiqi/ui';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { TopicTags } from '~/components/NoteList';
import type { Note } from '~/content/notes';
import type { NotePageData } from '~/content/notes/page.server';
import { useI18n } from '~/i18n';
import { ISLANDS } from './islands';

/**
 * One note as a page: title, topics, the translation switch and the body,
 * with any interactive islands in it mounted.
 */
export function NoteArticle({
  note,
  data,
  title = `notes/${note.folder}/${note.slug}.mdx`,
  crumbs,
  children,
}: {
  note: Note;
  data: NotePageData;
  /** Window title bar. */
  title?: string;
  /** Links shown above the title, before the date. */
  crumbs: ReactNode;
  /** Shown after the body (e.g. previous and next chapter). */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const { body } = data;
  const { Component } = note;
  const bodyRef = useRef<HTMLDivElement>(null);
  const islands = useIslands(
    bodyRef,
    ISLANDS,
    body.status === 'translated' ? body.html : note.href,
  );
  return (
    <Window title={title}>
      <article className="prose">
        <p className="prose__meta ui-pixel">
          {crumbs} · <time dateTime={note.date}>{note.date}</time>
        </p>
        <h1 lang={body.status === 'translated' ? undefined : 'en'}>{data.title}</h1>
        <TopicTags topics={note.topics} />
        {data.canSwitch && (
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
          <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: body.html }} />
        ) : (
          <div ref={bodyRef} lang="en">
            <Component />
          </div>
        )}
        {islands}
        {children}
      </article>
    </Window>
  );
}
