import { Card, List, ListItem, PixelIcon } from '@shiqi/ui';
import { Link } from 'react-router';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { NOTES } from '~/content/notes';
import { useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteMeta } from '~/i18n/notes.server';
import type { Route } from './+types/index';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.notes);

export async function loader({ request }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  return { noteText: await localizeNoteMeta(NOTES, locale) };
}

export default function NotesIndex({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  return (
    <PageWindow page="notes" title={t.notes.title} lede={t.notes.lede}>
      <Card>
        <List>
          {NOTES.map((n) => (
            <ListItem
              key={n.slug}
              as={Link}
              to={`/notes/${n.slug}`}
              icon={<PixelIcon name="book" />}
              title={loaderData.noteText[n.slug]?.title ?? n.title}
              description={loaderData.noteText[n.slug]?.summary ?? n.summary}
              meta={<time dateTime={n.date}>{n.date}</time>}
            />
          ))}
        </List>
      </Card>
    </PageWindow>
  );
}
