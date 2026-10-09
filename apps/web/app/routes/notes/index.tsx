import { Card, List, ListItem, PixelIcon, Section } from '@shiqi/ui';
import { Link } from 'react-router';
import { NoteList, TopicTags } from '~/components/NoteList';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { FOLDERS, NOTES, TOPICS, latestNotes, notesIn, notesTagged } from '~/content/notes';
import { format, useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteMeta } from '~/i18n/notes.server';
import type { Route } from './+types/index';

const LATEST = 5;

export async function loader({ request }: Route.LoaderArgs) {
  const topic = new URL(request.url).searchParams.get('topic');
  const { locale } = await resolveLocale(request);
  const shown = topic ? notesTagged(topic) : latestNotes(LATEST);
  return { topic, noteText: await localizeNoteMeta(shown, locale) };
}

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  const topic = loaderData?.topic;
  return pageMeta(matches, (t) =>
    topic
      ? {
          title: format(t.notes.topicTitle, { topic }),
          description: format(t.notes.topicDescription, { topic }),
        }
      : t.notes,
  );
};

export default function NotesIndex({ loaderData: { topic, noteText } }: Route.ComponentProps) {
  const { t } = useI18n();
  if (topic) {
    const tagged = notesTagged(topic);
    return (
      <PageWindow
        file={`notes/?topic=${topic}`}
        eyebrow="TOPIC"
        title={`#${topic}`}
        lede={
          <>
            {format(t.notes.count, { n: tagged.length })} ·{' '}
            <Link to="/notes">{t.notes.allNotes}</Link>
          </>
        }
      >
        <NoteList notes={tagged} text={noteText} />
      </PageWindow>
    );
  }

  return (
    <PageWindow page="notes" title={t.notes.title} lede={t.notes.lede}>
      <Card>
        <List>
          {FOLDERS.map((f) => (
            <ListItem
              key={f.id}
              as={Link}
              to={`/notes/${f.id}`}
              icon={<PixelIcon name={f.icon} />}
              title={t.notes.folders[f.id].title}
              description={t.notes.folders[f.id].description}
              meta={`${notesIn(f.id).length} ›`}
            />
          ))}
        </List>
      </Card>

      <Section
        eyebrow="TOPICS"
        title={t.notes.topics}
        description={format(t.notes.count, { n: NOTES.length })}
      >
        <TopicTags topics={TOPICS.map((tp) => tp.topic)} />
      </Section>

      <Section eyebrow="LATEST" title={t.notes.latest}>
        <NoteList notes={latestNotes(LATEST)} text={noteText} />
      </Section>
    </PageWindow>
  );
}
