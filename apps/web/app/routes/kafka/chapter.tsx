import { Link } from 'react-router';
import { NoteArticle } from '~/components/NoteArticle';
import { notePageData } from '~/content/notes/page.server';
import { chapterPath, chapters, findChapter } from '~/features/kafka-build/course';
import { format, useI18n } from '~/i18n';
import { metaStrings } from '~/i18n/root-data';
import { PAGES } from '~/site';
import type { Route } from './+types/chapter';

export const loader = ({ request, params }: Route.LoaderArgs) =>
  notePageData(request, findChapter(params.chapter));

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  const t = metaStrings(matches);
  return loaderData
    ? [
        { title: format(t.site.pageTitle, { title: loaderData.title }) },
        { name: 'description', content: loaderData.summary },
      ]
    : [{ title: format(t.site.pageTitle, { title: t.notes.missing }) }];
};

export default function Chapter({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  const list = chapters();
  const i = list.findIndex((n) => n.slug === loaderData.slug);
  const note = list[i];
  if (!note) return null;
  const prev = list[i - 1];
  const next = list[i + 1];
  return (
    <NoteArticle
      note={note}
      data={loaderData}
      title={`kafka/build/${chapterPath(note).split('/').pop()}.mdx`}
      crumbs={
        <>
          <Link to="/kafka">{PAGES.kafka.eyebrow}</Link> /{' '}
          <Link to="/kafka/build">{t.build.back}</Link> /{' '}
          {format(t.build.chapter, { n: note.series?.part ?? 0 })}
        </>
      }
    >
      <nav className="course-nav" aria-label={t.build.contents}>
        {prev ? (
          <Link to={chapterPath(prev)}>{format(t.build.prev, { title: prev.title })}</Link>
        ) : (
          <span />
        )}
        {next && <Link to={chapterPath(next)}>{format(t.build.next, { title: next.title })}</Link>}
      </nav>
      <p className="course-toc__summary">{t.build.saved}</p>
    </NoteArticle>
  );
}
