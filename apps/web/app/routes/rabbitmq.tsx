import '@shiqi/rabbitmq-viz/styles.css';

import {
  isScenarioId,
  RabbitLab,
  RabbitStringsProvider,
  type ScenarioId,
} from '@shiqi/rabbitmq-viz';
import { Button, Callout, Section } from '@shiqi/ui';
import { useState } from 'react';
import { useSearchParams, type ShouldRevalidateFunction } from 'react-router';
import { LabModeSwitch, useLabMode } from '~/components/LabMode';
import { NoteList } from '~/components/NoteList';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { notesTagged } from '~/content/notes';
import { RealBroker } from '~/features/rabbitmq-real/RealBroker';
import { useI18n } from '~/i18n';
import { resolveLocale } from '~/i18n/locale.server';
import { localizeNoteMeta } from '~/i18n/notes.server';
import type { Route } from './+types/rabbitmq';

/** Notes with this topic show up here as well as under /notes. */
const TOPIC = 'rabbitmq';

/** How to reach the real broker from your own computer (see infra/local/connect.sh). */
const CONNECT_COMMANDS = [
  'bash infra/local/connect.sh setup',
  'bash infra/local/connect.sh tunnel',
  'bash infra/local/connect.sh rabbitmq',
].join('\n');

/** The story every newcomer should see first. */
const FIRST_SCENARIO: ScenarioId = 'hello';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.rabbitmq);

// Opening a story only changes ?scenario=; the notes don't need reloading.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
  currentUrl.pathname !== nextUrl.pathname;

export async function loader({ request }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  return { noteText: await localizeNoteMeta(notesTagged(TOPIC), locale) };
}

export default function RabbitMQ({ loaderData: { noteText } }: Route.ComponentProps) {
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
      <PageWindow page="rabbitmq" title={t.rabbitmq.title} lede={t.rabbitmq.lede}>
        {mode === 'sim' && !current && (
          <Callout>
            <p>{t.rabbitmq.start.text}</p>
            <Button onClick={startHere}>{t.rabbitmq.start.button}</Button>
          </Callout>
        )}
        <LabModeSwitch mode={mode} onChange={onModeChange} text={t.rabbitmq.mode} />
        {mode === 'real' ? (
          <>
            <Callout>{t.rabbitmq.real.about}</Callout>
            <RealBroker />
            <Section
              className="rr-connect"
              eyebrow="AMQPS"
              title={t.rabbitmq.real.connect.title}
              description={t.rabbitmq.real.connect.text}
            >
              <pre>
                <code>{CONNECT_COMMANDS}</code>
              </pre>
            </Section>
          </>
        ) : (
          <>
            <RabbitStringsProvider strings={t.rabbitmq.lab}>
              <RabbitLab
                key={labKey}
                scenario={labKey > 0 ? FIRST_SCENARIO : current}
                onScenarioChange={onScenarioChange}
              />
            </RabbitStringsProvider>
            <Callout>{t.rabbitmq.simulated}</Callout>
          </>
        )}
        <Section eyebrow="NOTES" title={t.rabbitmq.notes} description={t.rabbitmq.notesLede}>
          {notes.length ? <NoteList notes={notes} text={noteText} /> : <p>{t.rabbitmq.noNotes}</p>}
        </Section>
      </PageWindow>
    </div>
  );
}
