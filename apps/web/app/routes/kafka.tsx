import '@shiqi/kafka-viz/styles.css';

import { isScenarioId, KafkaLab, KafkaStringsProvider, type ScenarioId } from '@shiqi/kafka-viz';
import { Button, Callout, Section } from '@shiqi/ui';
import { useState } from 'react';
import { Link, useSearchParams, type ShouldRevalidateFunction } from 'react-router';
import { LabModeSwitch, useLabMode } from '~/components/LabMode';
import { NoteList } from '~/components/NoteList';
import { RealCluster } from '~/features/kafka-real/RealCluster';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { notesTagged } from '~/content/notes';
import { useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteMeta } from '~/i18n/notes.server';
import type { Route } from './+types/kafka';

/** Notes with this topic show up here as well as under /notes. */
const TOPIC = 'kafka';

/** The happy path every newcomer should see first. */
const FIRST_SCENARIO: ScenarioId = 'first-record';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.kafka);

// Opening a scenario only changes ?scenario=; the notes don't need reloading.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
  currentUrl.pathname !== nextUrl.pathname;

export async function loader({ request }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  return { noteText: await localizeNoteMeta(notesTagged(TOPIC), locale) };
}

export default function Kafka({ loaderData: { noteText } }: Route.ComponentProps) {
  const { t } = useI18n();
  const notes = notesTagged(TOPIC);
  const [params, setParams] = useSearchParams();
  const scenario = params.get('scenario');
  const [mode, onModeChange] = useLabMode();
  const onScenarioChange = (id: ScenarioId | null) =>
    setParams(id ? { scenario: id } : {}, { replace: true, preventScrollReset: true });
  // The lab only reads ?scenario= when it mounts, so starting from here remounts it.
  const [labKey, setLabKey] = useState(0);
  const startHere = () => {
    onScenarioChange(FIRST_SCENARIO);
    setLabKey((n) => n + 1);
  };
  const current = isScenarioId(scenario) ? scenario : null;
  return (
    <div className="desk-wide">
      <PageWindow page="kafka" title={t.kafka.title} lede={t.kafka.lede}>
        {mode === 'sim' && !current && (
          <Callout>
            <p>{t.kafka.start.text}</p>
            <Button onClick={startHere}>{t.kafka.start.button}</Button>
          </Callout>
        )}
        <Callout>
          {t.kafka.course} <Link to="/kafka/build">{t.kafka.courseLink}</Link>
        </Callout>
        <LabModeSwitch mode={mode} onChange={onModeChange} text={t.kafka.mode} />
        {mode === 'real' ? (
          <>
            <Callout>{t.kafka.real.about}</Callout>
            <RealCluster />
          </>
        ) : (
          <>
            <KafkaStringsProvider strings={t.kafka.lab}>
              <KafkaLab
                key={labKey}
                scenario={labKey > 0 ? FIRST_SCENARIO : current}
                onScenarioChange={onScenarioChange}
              />
            </KafkaStringsProvider>
            <Callout>{t.kafka.simulated}</Callout>
          </>
        )}
        <Section eyebrow="NOTES" title={t.kafka.notes} description={t.kafka.notesLede}>
          {notes.length ? <NoteList notes={notes} text={noteText} /> : <p>{t.kafka.noNotes}</p>}
        </Section>
      </PageWindow>
    </div>
  );
}
