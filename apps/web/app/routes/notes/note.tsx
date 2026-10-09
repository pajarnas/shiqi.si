import { Link, data } from 'react-router';
import { Window } from '@shiqi/ui';
import { findNote } from '~/content/notes';
import type { Route } from './+types/note';

export function loader({ params }: Route.LoaderArgs) {
  const note = findNote(params.slug);
  if (!note) throw data(null, { status: 404, statusText: '没有这篇笔记' });
  return { slug: note.slug };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const note = findNote(loaderData?.slug);
  return note
    ? [{ title: `${note.title} · shiqi.si` }, { name: 'description', content: note.summary }]
    : [{ title: '没有这篇笔记 · shiqi.si' }];
};

export default function NotePage({ loaderData }: Route.ComponentProps) {
  const note = findNote(loaderData.slug);
  if (!note) return null;
  const { Component } = note;
  return (
    <Window title={`notes/${note.slug}.mdx`}>
      <article className="prose">
        <p className="prose__meta ui-pixel">
          <Link to="/notes">← NOTES</Link> · <time dateTime={note.date}>{note.date}</time>
        </p>
        <h1>{note.title}</h1>
        <Component />
      </article>
    </Window>
  );
}
