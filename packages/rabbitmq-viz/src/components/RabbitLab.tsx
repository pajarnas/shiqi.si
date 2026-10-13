import {
  LabLock,
  LabLockable,
  LabPanels,
  LabToolbar,
  ScenarioMenu,
  ScenarioPlayer,
  useLabClock,
  type LabStep,
  type StepText,
} from '@shiqi/lab';
import { BrokerTimeline, RabbitError, type Broker } from '@shiqi/rabbitmq';
import { useSimVersion, useTimeline } from '@shiqi/sim/react';
import { cx } from '@shiqi/ui';
import { useCallback, useState } from 'react';
import { useRabbitStrings } from '../i18n';
import {
  demoBroker,
  SCENARIO_GROUPS,
  SCENARIO_SOURCES,
  SCENARIOS,
  type ScenarioId,
  type ScenarioStep,
} from '../scenarios';
import { BeatFilter, eventWords, type Beat } from '../story';
import { EventLog } from './EventLog';
import { Explain } from './Explain';
import { Inspector } from './Inspector';
import { Legend } from './Legend';
import { ConsumePanel, DeclarePanel, PublishPanel, SettingsPanel } from './Panels';
import { Stage } from './Stage';
import { Terminal } from './Terminal';

const PANELS = [
  'inspect',
  'terminal',
  'declare',
  'publish',
  'consume',
  'settings',
  'events',
] as const;
type Panel = (typeof PANELS)[number];
const STEP_MS = 100;

export interface RabbitLabProps {
  /** The broker free play starts from. */
  initial?: () => Broker;
  /** Open this guided story first (e.g. from ?scenario=). */
  scenario?: ScenarioId | null;
  /** Called when a story opens or closes, to keep the URL in step. */
  onScenarioChange?: (id: ScenarioId | null) => void;
}

const picker = () => new BeatFilter();
const explain = (text: string, vars?: Record<string, string | number>) => (
  <Explain text={text} vars={vars} />
);
const expectedError = (e: unknown) => e instanceof RabbitError;
const firstQueue = (b: Broker) => [...b.queues.keys()][0] ?? null;

/**
 * The whole lab: a running broker on a live stage, guided stories, and panels
 * to look inside a queue, type rabbitmqctl, declare things, publish, consume,
 * change the network delay and read the event log. Every action is recorded,
 * so the timeline can rewind and replay.
 */
export function RabbitLab({
  initial = demoBroker,
  scenario: first = null,
  onScenarioChange,
}: RabbitLabProps) {
  const t = useRabbitStrings();
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(first);
  const { timeline, sim: broker } = useTimeline<Broker, BrokerTimeline>(
    () => new BrokerTimeline(first ? SCENARIOS[first].build : initial),
  );
  const clock = useLabClock(broker, timeline, first === null);
  const [panel, setPanel] = useState<Panel>('inspect');
  const [selected, setSelected] = useState<string | null>(() => firstQueue(broker));
  const [step, setStep] = useState<ScenarioStep | null>(null);
  const [storyFocus, setStoryFocus] = useState<string[] | null>(null);
  const [opened, setOpened] = useState(0);

  useSimVersion(broker);

  const start = (factory: () => Broker, id: ScenarioId | null) => {
    timeline.reset(factory);
    setScenarioId(id);
    clock.restart(id === null);
    setStep(null);
    setStoryFocus(null);
    setOpened((n) => n + 1);
    setSelected(firstQueue(timeline.sim));
    onScenarioChange?.(id);
  };
  const open = (id: ScenarioId) => start(SCENARIOS[id].build, id);
  const exit = () => start(initial, null);
  const reset = () => (scenarioId ? open(scenarioId) : start(initial, null));

  const select = (queue: string) => {
    setSelected(queue);
    setPanel('inspect');
  };

  const onStep = useCallback((s: LabStep<Broker>) => {
    const step = s as ScenarioStep;
    setStep(step);
    if (step.inspect) {
      setSelected(step.inspect);
      setPanel('inspect');
    }
  }, []);

  let focus: string[] = storyFocus ?? [];
  try {
    if (!storyFocus) focus = step?.focus?.(broker) ?? [];
  } catch {
    // The story's subject is gone (deleted by hand): nothing to point at.
  }
  const scenario = scenarioId ? SCENARIOS[scenarioId] : null;
  const s = t.scenarios;
  const beatWords = (b: Beat) => {
    const words = t.story.beats[b.kind];
    const vars = eventWords(b.event, t);
    return { title: explain(words.title, vars), body: explain(words.body, vars) };
  };

  return (
    <LabLock locked={!!scenario} note={t.lock.note}>
      <div className={cx('lab-app rv-app', scenario && 'lab-app--guided')}>
        <LabToolbar
          strings={t.toolbar}
          running={clock.running}
          onRunning={clock.setRunning}
          onStep={() => broker.tick(STEP_MS)}
          speed={clock.speed}
          onSpeed={clock.setSpeed}
          now={broker.now}
          end={timeline.end}
          stepMs={broker.settings.tickMs}
          rewound={timeline.rewound}
          onSeek={clock.seek}
          onReset={reset}
        />

        {scenario ? (
          <ScenarioPlayer
            key={`${scenario.id}:${opened}`}
            strings={s}
            storyStrings={t.story}
            loopStrings={t.loop}
            scenario={scenario}
            text={{
              title: s.list[scenario.id].title,
              steps: s.list[scenario.id].steps as Record<string, StepText>,
            }}
            sim={broker}
            clock={clock.driver}
            picker={picker}
            beatWords={beatWords}
            explain={explain}
            expectedError={expectedError}
            source={
              scenario.source
                ? {
                    label: s.sources[scenario.source as keyof typeof s.sources],
                    href: SCENARIO_SOURCES[scenario.source as keyof typeof SCENARIO_SOURCES],
                  }
                : undefined
            }
            nextTitle={scenario.next ? s.list[scenario.next].title : undefined}
            storageKey="rabbitmq"
            onStep={onStep}
            onFocus={setStoryFocus}
            onNext={() => scenario.next && open(scenario.next)}
            onExit={exit}
          />
        ) : (
          <ScenarioMenu
            strings={s}
            groups={Object.entries(SCENARIO_GROUPS).map(([group, ids]) => ({
              title: s.groups[group as keyof typeof s.groups],
              items: ids.map((id) => ({
                id,
                title: s.list[id].title,
                summary: s.list[id].summary,
              })),
            }))}
            onOpen={(id) => open(id as ScenarioId)}
          />
        )}

        {!scenario && <Legend />}
        <Stage
          broker={broker}
          speed={Number(clock.speed)}
          selected={selected}
          onSelect={select}
          focus={focus}
        />
        {scenario && <Legend />}

        <LabPanels
          label={t.panels.label}
          panels={PANELS}
          names={t.panels}
          value={panel}
          onChange={setPanel}
        >
          {panel === 'inspect' && <Inspector broker={broker} queue={selected} />}
          {panel === 'terminal' && (
            <LabLockable>
              <Terminal broker={broker} />
            </LabLockable>
          )}
          {panel === 'declare' && (
            <LabLockable>
              <DeclarePanel broker={broker} />
            </LabLockable>
          )}
          {panel === 'publish' && (
            <LabLockable>
              <PublishPanel broker={broker} />
            </LabLockable>
          )}
          {panel === 'consume' && (
            <LabLockable>
              <ConsumePanel broker={broker} />
            </LabLockable>
          )}
          {panel === 'settings' && (
            <LabLockable>
              <SettingsPanel broker={broker} />
            </LabLockable>
          )}
          {panel === 'events' && <EventLog broker={broker} />}
        </LabPanels>
      </div>
    </LabLock>
  );
}
