import { KafkaError, type Cluster } from '@shiqi/kafka';
import {
  ScenarioMenu as LabScenarioMenu,
  ScenarioPlayer as LabScenarioPlayer,
  type LabScenario,
  type LabStep,
  type StepText,
} from '@shiqi/lab';
import type { LoopDriver } from '@shiqi/sim/react';
import {
  SCENARIO_GROUPS,
  SCENARIO_SOURCES,
  type Scenario,
  type ScenarioId,
  type ScenarioStep,
} from '../scenarios';
import { BeatFilter } from '../story';
import { useKafkaStrings } from '../strings';
import { Explain } from './Explain';
import { beatWords } from './Story';

export interface ScenarioPlayerProps {
  scenario: Scenario;
  cluster: Cluster;
  /** Runs the simulation for the story, rewinds, and loops a played step. */
  clock: LoopDriver<Cluster>;
  /** The step on screen changed (for highlights and the inspector). */
  onStep: (step: ScenarioStep) => void;
  /** What the story is pointing at right now; null to go back to the step's own focus. */
  onFocus: (ids: string[] | null) => void;
  onOpen: (id: ScenarioId) => void;
  onExit: () => void;
}

const picker = () => new BeatFilter();
const explain = (text: string, vars?: Record<string, string | number>) => (
  <Explain text={text} vars={vars} />
);
const expectedError = (e: unknown) => e instanceof KafkaError;

/** One Kafka scenario in @shiqi/lab's player: read, guess, play, see why. */
export function ScenarioPlayer({
  scenario,
  cluster,
  clock,
  onStep,
  onFocus,
  onOpen,
  onExit,
}: ScenarioPlayerProps) {
  const t = useKafkaStrings();
  const s = t.scenarios;
  const text = s.list[scenario.id];
  const next = scenario.next;
  return (
    <LabScenarioPlayer
      strings={s}
      storyStrings={t.story}
      loopStrings={t.loop}
      scenario={scenario as LabScenario<Cluster>}
      text={{ title: text.title, steps: text.steps as Record<string, StepText> }}
      sim={cluster}
      clock={clock}
      picker={picker}
      beatWords={(b) => beatWords(b, t)}
      explain={explain}
      expectedError={expectedError}
      source={
        scenario.source
          ? {
              label: s.sources[scenario.source as keyof typeof s.sources],
              href: SCENARIO_SOURCES[scenario.source] ?? '',
            }
          : undefined
      }
      nextTitle={next ? s.list[next].title : undefined}
      storageKey="kafka"
      onStep={onStep as (step: LabStep<Cluster>) => void}
      onFocus={onFocus}
      onNext={() => next && onOpen(next)}
      onExit={onExit}
    />
  );
}

/** Every scenario, grouped, with a Start button each. */
export function ScenarioMenu({ onOpen }: { onOpen: (id: ScenarioId) => void }) {
  const t = useKafkaStrings();
  const s = t.scenarios;
  const groups = Object.entries(SCENARIO_GROUPS).map(([group, ids]) => ({
    title: s.groups[group as keyof typeof s.groups],
    items: ids.map((id) => ({ id, title: s.list[id].title, summary: s.list[id].summary })),
  }));
  return <LabScenarioMenu strings={s} groups={groups} onOpen={(id) => onOpen(id as ScenarioId)} />;
}
