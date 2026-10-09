import { data, redirect } from 'react-router';
import { NoteList } from '~/components/NoteList';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { findFolder, findNoteBySlug, notesIn } from '~/content/notes';
import { stringsFor, useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteMeta } from '~/i18n/notes.server';
import type { Route } from './+types/folder';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  const f = findFolder(params.folder);
  if (f) return { folder: f.id, noteText: await localizeNoteMeta(notesIn(f.id), locale) };
  // Notes lived at /notes/<slug> before folders existed.
  const moved = findNoteBySlug(params.folder);
  if (moved) throw redirect(moved.href, 301);
  throw data(null, { status: 404, statusText: stringsFor(locale).notes.folderMissing });
}

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  const f = findFolder(loaderData?.folder);
  return f ? pageMeta(matches, (t) => t.notes.folders[f.id]) : [];
};

export default function NotesFolder({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  const f = findFolder(loaderData.folder)!;
  return (
    <PageWindow
      file={`notes/${f.id}/`}
      eyebrow={f.label}
      title={t.notes.folders[f.id].title}
      lede={t.notes.folders[f.id].description}
    >
      <NoteList notes={notesIn(f.id)} text={loaderData.noteText} />
    </PageWindow>
  );
}
