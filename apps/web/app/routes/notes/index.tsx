import { Card, List, ListItem, PixelIcon, Section } from '@shiqi/ui';
import { Link } from 'react-router';
import { NoteList, TopicTags } from '~/components/NoteList';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { FOLDERS, NOTES, TOPICS, latestNotes, notesIn, notesTagged } from '~/content/notes';
import type { Route } from './+types/index';

export function loader({ request }: Route.LoaderArgs) {
  return { topic: new URL(request.url).searchParams.get('topic') };
}

export const meta: Route.MetaFunction = ({ loaderData }) =>
  loaderData?.topic
    ? pageMeta(`#${loaderData.topic} · 笔记`, `所有带 #${loaderData.topic} 话题的笔记。`)
    : pageMeta('笔记', '学习流水、杂学和随想：按文件夹和话题整理的笔记。');

export default function NotesIndex({ loaderData: { topic } }: Route.ComponentProps) {
  if (topic) {
    const tagged = notesTagged(topic);
    return (
      <PageWindow
        file={`notes/?topic=${topic}`}
        eyebrow="TOPIC"
        title={`#${topic}`}
        lede={
          <>
            {tagged.length} 篇笔记 · <Link to="/notes">← 全部笔记</Link>
          </>
        }
      >
        <NoteList notes={tagged} />
      </PageWindow>
    );
  }

  return (
    <PageWindow
      file="notes/"
      eyebrow="NOTES"
      title="笔记"
      lede="每天学了什么记在学习流水里；能单独成篇的知识整理进杂学。"
    >
      <Card>
        <List>
          {FOLDERS.map((f) => (
            <ListItem
              key={f.id}
              as={Link}
              to={`/notes/${f.id}`}
              icon={<PixelIcon name={f.icon} />}
              title={`${f.title} · ${f.subtitle}`}
              description={f.description}
              meta={`${notesIn(f.id).length} ›`}
            />
          ))}
        </List>
      </Card>

      <Section eyebrow="TOPICS" title="话题" description={`${NOTES.length} 篇笔记`}>
        <TopicTags topics={TOPICS.map((t) => t.topic)} />
      </Section>

      <Section eyebrow="LATEST" title="最近">
        <NoteList notes={latestNotes(5)} />
      </Section>
    </PageWindow>
  );
}
