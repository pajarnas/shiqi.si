import { Card, List, ListItem, PixelIcon } from '@shiqi/ui';
import { Link } from 'react-router';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { NOTES } from '~/content/notes';

export const meta = () => pageMeta('笔记', '关于像素、标准和这个网站的一些想法。');

export default function NotesIndex() {
  return (
    <PageWindow
      file="notes/"
      eyebrow="NOTES"
      title="笔记"
      lede="一些想法。以后课程笔记也会放在这里。"
    >
      <Card>
        <List>
          {NOTES.map((n) => (
            <ListItem
              key={n.slug}
              as={Link}
              to={`/notes/${n.slug}`}
              icon={<PixelIcon name="book" />}
              title={n.title}
              description={n.summary}
              meta={<time dateTime={n.date}>{n.date}</time>}
            />
          ))}
        </List>
      </Card>
    </PageWindow>
  );
}
