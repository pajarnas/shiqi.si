import { data, redirect } from 'react-router';
import { NoteList } from '~/components/NoteList';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { findFolder, findNoteBySlug, notesIn } from '~/content/notes';
import type { Route } from './+types/folder';

export function loader({ params }: Route.LoaderArgs) {
  if (findFolder(params.folder)) return { folder: params.folder };
  // Notes lived at /notes/<slug> before folders existed.
  const moved = findNoteBySlug(params.folder);
  if (moved) throw redirect(moved.href, 301);
  throw data(null, { status: 404, statusText: '没有这个文件夹' });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const f = findFolder(loaderData?.folder);
  return f ? pageMeta(`${f.title} · ${f.subtitle}`, f.description) : [];
};

export default function NotesFolder({ loaderData }: Route.ComponentProps) {
  const f = findFolder(loaderData.folder)!;
  return (
    <PageWindow
      file={`notes/${f.id}/`}
      eyebrow={f.title.toUpperCase()}
      title={f.subtitle}
      lede={f.description}
    >
      <NoteList notes={notesIn(f.id)} />
    </PageWindow>
  );
}
