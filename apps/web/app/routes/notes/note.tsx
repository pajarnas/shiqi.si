import { Link, data } from 'react-router';
import { Window } from '@shiqi/ui';
import { TopicTags } from '~/components/NoteList';
import { findFolder, findNote } from '~/content/notes';
import type { Route } from './+types/note';

export function loader({ params }: Route.LoaderArgs) {
  const note = findNote(params.folder, params.slug);
  if (!note) throw data(null, { status: 404, statusText: '没有这篇笔记' });
  return { folder: note.folder, slug: note.slug };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const note = findNote(loaderData?.folder, loaderData?.slug);
  return note
    ? [{ title: `${note.title} · shiqi.si` }, { name: 'description', content: note.summary }]
    : [{ title: '没有这篇笔记 · shiqi.si' }];
};

export default function NotePage({ loaderData }: Route.ComponentProps) {
  const note = findNote(loaderData.folder, loaderData.slug);
  if (!note) return null;
  const { Component } = note;
  const folder = findFolder(note.folder)!;
  return (
    <Window title={`notes/${note.folder}/${note.slug}.mdx`}>
      <article className="prose">
        <p className="prose__meta ui-pixel">
          <Link to="/notes">NOTES</Link> / <Link to={`/notes/${folder.id}`}>{folder.title}</Link> ·{' '}
          <time dateTime={note.date}>{note.date}</time>
        </p>
        <h1>{note.title}</h1>
        <TopicTags topics={note.topics} />
        <Component />
      </article>
    </Window>
  );
}
