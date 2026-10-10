import { Button, Section } from '@shiqi/ui';
import { Link } from 'react-router';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { chapterPath, chapters } from '~/features/kafka-build/course';
import { format, useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteMeta } from '~/i18n/notes.server';
import type { Route } from './+types/build';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.build);

export async function loader({ request }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  return { text: await localizeNoteMeta(chapters(), locale) };
}

export default function BuildKafka({ loaderData: { text } }: Route.ComponentProps) {
  const { t } = useI18n();
  const list = chapters();
  const first = list[0];
  return (
    <PageWindow file="kafka/build/" eyebrow="KAFKA" title={t.build.title} lede={t.build.lede}>
      {first && (
        <p>
          <Button as={Link} to={chapterPath(first)}>
            {t.build.start}
          </Button>
        </p>
      )}
      <Section eyebrow="CHAPTERS" title={t.build.contents}>
        <ol className="course-toc">
          {list.map((n) => (
            <li key={n.slug}>
              <span className="ui-pixel">
                {format(t.build.chapter, { n: n.series?.part ?? 0 })}
              </span>{' '}
              <Link to={chapterPath(n)}>{text[n.href]?.title ?? n.title}</Link>
              <p className="course-toc__summary">{text[n.href]?.summary ?? n.summary}</p>
            </li>
          ))}
        </ol>
        <p className="course-toc__summary">{t.build.soon}</p>
      </Section>
      <p>
        <Link to="/kafka">{t.build.lab}</Link>
      </p>
    </PageWindow>
  );
}
