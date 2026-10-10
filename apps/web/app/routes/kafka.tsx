import '@shiqi/kafka-viz/styles.css';

import { KafkaLab, KafkaStringsProvider } from '@shiqi/kafka-viz';
import { Callout, Section } from '@shiqi/ui';
import { NoteList } from '~/components/NoteList';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { notesTagged } from '~/content/notes';
import { useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteMeta } from '~/i18n/notes.server';
import type { Route } from './+types/kafka';

/** Notes with this topic show up here as well as under /notes. */
const TOPIC = 'kafka';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.kafka);

export async function loader({ request }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  return { noteText: await localizeNoteMeta(notesTagged(TOPIC), locale) };
}

export default function Kafka({ loaderData: { noteText } }: Route.ComponentProps) {
  const { t } = useI18n();
  const notes = notesTagged(TOPIC);
  return (
    <div className="desk-wide">
      <PageWindow page="kafka" title={t.kafka.title} lede={t.kafka.lede}>
        <KafkaStringsProvider strings={t.kafka.lab}>
          <KafkaLab />
        </KafkaStringsProvider>
        <Callout>{t.kafka.simulated}</Callout>
        <Section eyebrow="NOTES" title={t.kafka.notes} description={t.kafka.notesLede}>
          {notes.length ? <NoteList notes={notes} text={noteText} /> : <p>{t.kafka.noNotes}</p>}
        </Section>
      </PageWindow>
    </div>
  );
}
