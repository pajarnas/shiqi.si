import { Link, redirect } from 'react-router';
import { NoteArticle } from '~/components/NoteArticle';
import { findFolder, findMovedNote, findNote, subfoldersIn } from '~/content/notes';
import { notePageData } from '~/content/notes/page.server';
import { format, useI18n } from '~/i18n';
import { subfolderTitle } from '~/content/notes/subfolders';
import { metaStrings } from '~/i18n/root-data';
import type { Route } from './+types/note';

export function loader({ request, params }: Route.LoaderArgs) {
  const { folder, slug } = params;
  const sub = 'sub' in params ? (params.sub as string | undefined) : undefined;
  const note = findNote(folder, sub ? `${sub}/${slug}` : slug);
  if (!note && !sub) {
    // /notes/<folder>/<subfolder> lists the subfolder on the folder page.
    if (subfoldersIn(folder).includes(slug)) throw redirect(`/notes/${folder}#${slug}`, 301);
    // The note moved into a subfolder.
    const moved = findMovedNote(folder, slug);
    if (moved) throw redirect(moved.href, 301);
  }
  return notePageData(request, note);
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
  const note = findNote(loaderData.folder, loaderData.slug);
  if (!note) return null;
  const folder = findFolder(note.folder)!;
  return (
    <NoteArticle
      note={note}
      data={loaderData}
      crumbs={
        <>
          <Link to="/notes">{t.notes.back}</Link> /{' '}
          <Link to={`/notes/${folder.id}`}>{t.notes.folders[folder.id].title}</Link>
          {note.subfolder && (
            <>
              {' '}
              /{' '}
              <Link to={`/notes/${folder.id}#${note.subfolder}`}>
                {subfolderTitle(t, note.subfolder)}
              </Link>
            </>
          )}
        </>
      }
    />
  );
}
