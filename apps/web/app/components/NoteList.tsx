import { Card, List, ListItem, PixelIcon } from '@shiqi/ui';
import { Link } from 'react-router';
import { findFolder, type Note } from '~/content/notes';
import type { NoteText } from '~/i18n/notes';

/**
 * Notes as a Settings-style list; each row links to the note. `text` holds
 * translated titles and summaries by href; notes without one show the English.
 */
export function NoteList({ notes, text = {} }: { notes: readonly Note[]; text?: NoteText }) {
  return (
    <Card>
      <List>
        {notes.map((n) => (
          <ListItem
            key={n.href}
            as={Link}
            to={n.href}
            icon={<PixelIcon name={findFolder(n.folder)?.icon ?? 'note'} />}
            title={text[n.href]?.title ?? n.title}
            description={text[n.href]?.summary ?? n.summary}
            meta={<time dateTime={n.date}>{n.date}</time>}
          />
        ))}
      </List>
    </Card>
  );
}

/** Topic tags; each one links to the notes that share it. */
export function TopicTags({ topics }: { topics: readonly string[] }) {
  return (
    <ul className="topic-tags">
      {topics.map((t) => (
        <li key={t}>
          <Link className="topic-tag" to={`/notes?topic=${encodeURIComponent(t)}`}>
            #{t}
          </Link>
        </li>
      ))}
    </ul>
  );
}
