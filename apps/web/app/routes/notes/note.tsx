import { Link } from 'react-router';
import { NoteArticle } from '~/components/NoteArticle';
import { findFolder, findNote } from '~/content/notes';
import { notePageData } from '~/content/notes/page.server';
import { format, useI18n } from '~/i18n';
import { metaStrings } from '~/i18n/root-data';
import type { Route } from './+types/note';

export const loader = ({ request, params }: Route.LoaderArgs) =>
  notePageData(request, findNote(params.folder, params.slug));

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
        </>
      }
    />
  );
}
