import { describe, expect, it } from 'vitest';
import { Cluster } from './cluster';
import { Timeline } from './timeline';

const start = () => {
  const c = new Cluster({ brokers: 3, seed: 11 });
  c.createTopic('t', { partitions: 2, replicationFactor: 3 });
  c.addProducer({ id: 'p', topic: 't', rate: 10, keys: 'fixed' });
  return c;
};

const state = (c: Cluster) =>
  JSON.stringify({
    now: c.now,
    parts: c.allPartitions().map((p) => [p.leader, p.isr, p.highWatermark]),
    events: c.events.length,
  });

describe('Timeline', () => {
  it('rewinds to the same state by replaying recorded actions', () => {
    const tl = new Timeline(start);
    tl.cluster.tick(2000);
    tl.cluster.stopBroker(1);
    tl.cluster.tick(1000);
    const at3 = state(tl.cluster);
    tl.cluster.startBroker(1);
    tl.cluster.tick(2000);
    const at5 = state(tl.cluster);

    tl.seek(3000);
    expect(state(tl.cluster)).toBe(at3);
    expect(tl.rewound).toBe(true);
    tl.seek(5000);
    expect(state(tl.cluster)).toBe(at5);

    tl.seek(1000);
    tl.cluster.tick(4000); // playing on from the past replays the recorded future
    expect(state(tl.cluster)).toBe(at5);
    expect(tl.rewound).toBe(false);
  });

  it('drops the old future when you act in the past', () => {
    const tl = new Timeline(start);
    tl.cluster.tick(1000);
    tl.cluster.stopBroker(2);
    tl.cluster.tick(1000);
    tl.seek(500);
    tl.cluster.updateProducer('p', { paused: true });
    expect(tl.entries.map((e) => e.action)).toEqual(['updateProducer']);
    expect(tl.end).toBe(500);
    tl.cluster.tick(1000);
    expect(tl.cluster.brokers.get(2)?.up).toBe(true);
  });

  it('tells views when a rewind swaps the cluster', () => {
    const tl = new Timeline(start);
    const seen: Cluster[] = [];
    tl.onReplace((c) => seen.push(c));
    tl.cluster.tick(1000);
    const before = tl.cluster;
    tl.seek(0);
    expect(seen).toHaveLength(1);
    expect(tl.cluster).not.toBe(before);
  });
});
