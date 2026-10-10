import type { Cluster } from '@shiqi/kafka';
import { Button, cx, Range, Segmented } from '@shiqi/ui';
import { useCallback, useState } from 'react';
import { demoCluster } from '../demo';
import { clock } from '../format';
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

const SPEEDS = ['0.25', '0.5', '1', '2', '4'] as const;
type Speed = (typeof SPEEDS)[number];
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

  let focus: string[] = [];
  try {
    focus = step?.focus?.(cluster) ?? [];
  } catch {
    // The scenario's subject is gone (deleted by hand): nothing to point at.
  }
  const lostAcked = cluster.allPartitions().reduce((n, p) => n + p.goneAcked, 0);
  const scenario = scenarioId ? SCENARIOS[scenarioId] : null;

  return (
    <div className={cx('kv-app', scenario && 'kv-app--guided')}>
      <div className="kv-toolbar">
        <Button size="sm" onClick={() => setRunning((r) => !r)}>
          {running ? t.toolbar.pause : t.toolbar.play}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={running}
          onClick={() => cluster.tick(STEP_MS)}
        >
          {t.toolbar.step}
        </Button>
        <Segmented
          label={t.toolbar.speed}
          options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))}
          value={speed}
          onChange={setSpeed}
        />
        <Range
          className="kv-toolbar__timeline"
          aria-label={t.toolbar.timeline}
          title={t.toolbar.timeline}
          min={0}
          max={Math.max(timeline.end, 1)}
          step={cluster.settings.tickMs}
          value={cluster.now}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span className="kv-toolbar__clock ui-pixel">
          {format(t.toolbar.clock, { time: clock(cluster.now) })}
        </span>
        {timeline.rewound && (
          <Button size="sm" variant="ghost" onClick={() => seek(timeline.end)}>
            {t.toolbar.goLive}
          </Button>
        )}
        {lostAcked > 0 && (
          <span className="kv-tag kv-tag--bad">{format(t.toolbar.lost, { n: lostAcked })}</span>
        )}
        <Button size="sm" variant="ghost" onClick={reset}>
          {t.toolbar.reset}
        </Button>
      </div>
      {timeline.rewound && <p className="kv-muted kv-toolbar__note">{t.toolbar.rewound}</p>}

      {scenario ? (
        <ScenarioPlayer
          key={`${scenario.id}:${opened}`}
          scenario={scenario}
          cluster={cluster}
          timeline={timeline}
          onRun={run}
          onStep={onStep}
          onOpen={open}
          onExit={exit}
        />
      ) : (
        <ScenarioMenu onOpen={open} />
      )}

      <Legend />

      <Stage
        cluster={cluster}
        speed={Number(speed)}
        selected={selected}
        onSelect={select}
        focus={focus}
      />

      <div className="kv-panels">
        <Segmented
          label={t.panels.label}
          options={PANELS.map((p) => ({ value: p, label: t.panels[p] }))}
          value={panel}
          onChange={setPanel}
        />
        <div className="kv-panels__body">
          {panel === 'inspect' && <Inspector cluster={cluster} selected={selected} />}
          {panel === 'wire' && <WireView cluster={cluster} selected={selected} />}
          {panel === 'terminal' && <Terminal cluster={cluster} />}
          {panel === 'topics' && <TopicsPanel cluster={cluster} />}
          {panel === 'produce' && <ProducersPanel cluster={cluster} />}
          {panel === 'consume' && <ConsumersPanel cluster={cluster} />}
          {panel === 'settings' && <SettingsPanel cluster={cluster} />}
          {panel === 'events' && <EventLog cluster={cluster} />}
        </div>
      </div>
    </div>
  );
}
