import type { Cluster } from '@shiqi/kafka';
import { Button, Segmented } from '@shiqi/ui';
import { useState, type CSSProperties } from 'react';
import { demoCluster } from '../demo';
import { clock } from '../format';
import { useClusterVersion, useSimulation } from '../hooks/useSimulation';
import { KEY_COLORS } from '../keys';
import { format, useKafkaStrings } from '../strings';
import { EventLog } from './EventLog';
import { Inspector } from './Inspector';
import { ConsumersPanel, ProducersPanel, TopicsPanel } from './Panels';
import { Stage, type Selection } from './Stage';
import { Terminal } from './Terminal';

const SPEEDS = ['0.25', '0.5', '1', '2', '4'] as const;
type Speed = (typeof SPEEDS)[number];
const PANELS = ['inspect', 'terminal', 'topics', 'produce', 'consume', 'events'] as const;
type Panel = (typeof PANELS)[number];
const STEP_MS = 250;

/**
 * The whole lab: a running cluster, the live stage, and panels to inspect a
 * partition, drive the cluster from a terminal or forms, and read the event log.
 */
export function KafkaLab({ initial = demoCluster }: { initial?: () => Cluster }) {
  const t = useKafkaStrings();
  const [cluster, setCluster] = useState(initial);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<Speed>('1');
  const [panel, setPanel] = useState<Panel>('inspect');
  const [selected, setSelected] = useState<Selection | null>(() => {
    const p = cluster.allPartitions()[0];
    return p ? { topic: p.topic, partition: p.id } : null;
  });

  useSimulation(cluster, running, Number(speed));
  useClusterVersion(cluster);

  const reset = () => {
    setCluster(initial());
  };

  const select = (s: Selection) => {
    setSelected(s);
    setPanel('inspect');
  };

  return (
    <div className="kv-app">
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
        <span className="kv-toolbar__clock ui-pixel">
          {format(t.toolbar.clock, { time: clock(cluster.now) })}
        </span>
        <Button size="sm" variant="ghost" onClick={reset}>
          {t.toolbar.reset}
        </Button>
      </div>

      <Stage cluster={cluster} speed={Number(speed)} selected={selected} onSelect={select} />

      <Legend />

      <div className="kv-panels">
        <Segmented
          label={t.panels.label}
          options={PANELS.map((p) => ({ value: p, label: t.panels[p] }))}
          value={panel}
          onChange={setPanel}
        />
        <div className="kv-panels__body">
          {panel === 'inspect' && <Inspector cluster={cluster} selected={selected} />}
          {panel === 'terminal' && <Terminal cluster={cluster} />}
          {panel === 'topics' && <TopicsPanel cluster={cluster} />}
          {panel === 'produce' && <ProducersPanel cluster={cluster} />}
          {panel === 'consume' && <ConsumersPanel cluster={cluster} />}
          {panel === 'events' && <EventLog cluster={cluster} />}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const t = useKafkaStrings();
  return (
    <details className="kv-legend">
      <summary>{t.legend.title}</summary>
      <ul>
        <li>
          {Array.from({ length: KEY_COLORS }, (_, i) => (
            <span
              key={i}
              className="kv-cell"
              style={{ '--cell': `var(--kv-key-${i})` } as CSSProperties}
            />
          ))}{' '}
          {t.legend.record} ·{' '}
          <span className="kv-cell" style={{ '--cell': 'var(--kv-key-none)' } as CSSProperties} />{' '}
          {t.legend.nullKey}
        </li>
        <li>
          <span className="kv-replica__role kv-replica__role--demo kv-replica--leader">L</span>{' '}
          {t.legend.leader}
        </li>
        <li>
          <span className="kv-replica__role kv-replica__role--demo kv-replica--follower">F</span>{' '}
          {t.legend.follower}
        </li>
        <li>
          <span className="kv-replica__role kv-replica__role--demo kv-replica--out">×</span>{' '}
          {t.legend.outOfSync}
        </li>
        <li>
          <span className="kv-swatch kv-swatch--hw" /> {t.legend.hw}
        </li>
      </ul>
    </details>
  );
}
