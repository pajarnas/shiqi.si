import type { Cluster } from '@shiqi/kafka';
import { LabPanels, LabToolbar, type Speed } from '@shiqi/lab';
import { cx } from '@shiqi/ui';
import { useCallback, useState } from 'react';
import { demoCluster } from '../demo';
import { useClusterVersion, useSimulation, useTimeline } from '../hooks/useSimulation';
import { SCENARIOS, type ScenarioId, type ScenarioStep } from '../scenarios';
import { format, useKafkaStrings } from '../strings';
import { EventLog } from './EventLog';
import { Inspector } from './Inspector';
import { ConsumersPanel, ProducersPanel, SettingsPanel, TopicsPanel } from './Panels';
import { ScenarioMenu, ScenarioPlayer } from './ScenarioPlayer';
import { Stage, type Selection } from './Stage';
import { Legend } from './Legend';
import { Terminal } from './Terminal';
import { WireView } from './WireView';

const PANELS = [
  'inspect',
  'wire',
  'terminal',
  'topics',
  'produce',
  'consume',
  'settings',
  'events',
] as const;
type Panel = (typeof PANELS)[number];
const STEP_MS = 250;

interface Goal {
  until: (c: Cluster) => boolean;
  done: () => void;
}

export interface KafkaLabProps {
  /** The cluster free play starts from. */
  initial?: () => Cluster;
  /** Open this guided scenario first (e.g. from ?scenario=). */
  scenario?: ScenarioId | null;
  /** Called when a scenario opens or closes, to keep the URL in step. */
  onScenarioChange?: (id: ScenarioId | null) => void;
}

const firstPartition = (c: Cluster): Selection | null => {
  const p = c.allPartitions()[0];
  return p ? { topic: p.topic, partition: p.id } : null;
};

/**
 * The whole lab: a running cluster, the live stage, guided scenarios, and
 * panels to inspect a partition, watch its requests, drive the cluster from a
 * terminal or forms, change cluster settings and read the event log. Every
 * action is recorded, so the timeline can rewind and replay.
 */
export function KafkaLab({
  initial = demoCluster,
  scenario: first = null,
  onScenarioChange,
}: KafkaLabProps) {
  const t = useKafkaStrings();
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(first);
  const { timeline, cluster } = useTimeline(first ? SCENARIOS[first].build : initial);
  const [running, setRunning] = useState(first === null);
  const [speed, setSpeed] = useState<Speed>('1');
  const [panel, setPanel] = useState<Panel>('inspect');
  const [selected, setSelected] = useState<Selection | null>(() => firstPartition(cluster));
  const [goal, setGoal] = useState<Goal | null>(null);
  const [step, setStep] = useState<ScenarioStep | null>(null);
  const [storyFocus, setStoryFocus] = useState<string[] | null>(null);
  const [opened, setOpened] = useState(0);

  useSimulation(cluster, running, Number(speed), {
    stopWhen: goal?.until,
    onStop: () => {
      setRunning(false);
      setGoal(null);
      goal?.done();
    },
  });
  useClusterVersion(cluster);

  const start = (factory: () => Cluster, id: ScenarioId | null) => {
    timeline.reset(factory);
    setScenarioId(id);
    setGoal(null);
    setStep(null);
    setStoryFocus(null);
    setOpened((n) => n + 1);
    setRunning(id === null);
    setSelected(firstPartition(timeline.cluster));
    onScenarioChange?.(id);
  };
  const open = (id: ScenarioId) => start(SCENARIOS[id].build, id);
  const exit = () => start(initial, null);
  const reset = () => (scenarioId ? open(scenarioId) : start(initial, null));

  const select = (s: Selection) => {
    setSelected(s);
    if (panel !== 'wire') setPanel('inspect');
  };

  const onStep = useCallback(
    (s: ScenarioStep) => {
      setStep(s);
      const target = s.inspect?.(timeline.cluster);
      if (target) {
        setSelected(target);
        setPanel((p) => (p === 'wire' ? p : 'inspect'));
      }
    },
    [timeline],
  );

  const run = (until: Goal['until'], done: Goal['done']) => {
    setGoal({ until, done });
    setRunning(true);
  };

  const seek = (time: number) => {
    setRunning(false);
    setGoal(null);
    timeline.seek(time);
  };

  let focus: string[] = storyFocus ?? [];
  try {
    if (!storyFocus) focus = step?.focus?.(cluster) ?? [];
  } catch {
    // The scenario's subject is gone (deleted by hand): nothing to point at.
  }
  const lostAcked = cluster.allPartitions().reduce((n, p) => n + p.goneAcked, 0);
  const scenario = scenarioId ? SCENARIOS[scenarioId] : null;

  return (
    <div className={cx('lab-app kv-app', scenario && 'lab-app--guided')}>
      <LabToolbar
        strings={t.toolbar}
        running={running}
        onRunning={setRunning}
        onStep={() => cluster.tick(STEP_MS)}
        speed={speed}
        onSpeed={setSpeed}
        now={cluster.now}
        end={timeline.end}
        stepMs={cluster.settings.tickMs}
        rewound={timeline.rewound}
        onSeek={seek}
        onReset={reset}
      >
        {lostAcked > 0 && (
          <span className="kv-tag kv-tag--bad">{format(t.toolbar.lost, { n: lostAcked })}</span>
        )}
      </LabToolbar>

      {scenario ? (
        <ScenarioPlayer
          key={`${scenario.id}:${opened}`}
          scenario={scenario}
          cluster={cluster}
          timeline={timeline}
          onRun={run}
          onStep={onStep}
          onFocus={setStoryFocus}
          onOpen={open}
          onExit={exit}
        />
      ) : (
        <ScenarioMenu onOpen={open} />
      )}

      {/* In a scenario the stage comes first, so the story and what it describes sit side by side. */}
      {!scenario && <Legend />}

      <Stage
        cluster={cluster}
        speed={Number(speed)}
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
        {panel === 'inspect' && <Inspector cluster={cluster} selected={selected} />}
        {panel === 'wire' && <WireView cluster={cluster} selected={selected} />}
        {panel === 'terminal' && <Terminal cluster={cluster} />}
        {panel === 'topics' && <TopicsPanel cluster={cluster} />}
        {panel === 'produce' && <ProducersPanel cluster={cluster} />}
        {panel === 'consume' && <ConsumersPanel cluster={cluster} />}
        {panel === 'settings' && <SettingsPanel cluster={cluster} />}
        {panel === 'events' && <EventLog cluster={cluster} />}
      </LabPanels>
    </div>
  );
}
