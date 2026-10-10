import { describe, expect, it } from 'vitest';
import { Cluster } from './cluster';
import type { TruncationMode } from './config';

const acked = (c: Cluster, offset: number) =>
  c.events.some((e) => e.type === 'ack' && e.offset === offset && !e.error);

const until = (c: Cluster, done: () => boolean, max = 20_000) => {
  for (let t = 0; t < max && !done(); t += 50) c.tick(50);
};

const values = (c: Cluster, broker: number) =>
  c
    .partition('t', 0)
    .logs.get(broker)
    ?.read(0)
    .map((r) => r.value);

/** KIP-101 scenario 1: a follower restarts while its HW still trails the leader's. */
function quickRestart(truncation: TruncationMode) {
  const c = new Cluster({ brokers: 2, truncation });
  c.createTopic('t', { partitions: 1, replicationFactor: 2 });
  const p = c.partition('t', 0);
  const [a, b] = p.replicas as [number, number];
  c.produce({ topic: 't', value: 'm1' });
  until(c, () => acked(c, 0));
  c.produce({ topic: 't', value: 'm2' });
  until(c, () => acked(c, 1));
  const followerHw = p.logs.get(b)?.highWatermark;
  c.restartBroker(b);
  c.stopBroker(a);
  return { c, a, b, followerHw, leader: p.leader };
}

/** KIP-101 scenario 2: both replicas lose power; only the leader had flushed m2. */
function powerLoss(truncation: TruncationMode) {
  const c = new Cluster({ brokers: 2, truncation, flushIntervalMs: -1 });
  c.createTopic('t', { partitions: 1, replicationFactor: 2 });
  const [a, b] = c.partition('t', 0).replicas as [number, number];
  c.produce({ topic: 't', value: 'm1' });
  until(c, () => acked(c, 0));
  c.flushBroker(a);
  c.flushBroker(b);
  c.produce({ topic: 't', value: 'm2' });
  until(c, () => acked(c, 1));
  c.flushBroker(a);
  c.stopBroker(a, { hard: true });
  c.stopBroker(b, { hard: true });
  c.startBroker(b);
  c.produce({ topic: 't', value: 'm3' });
  c.startBroker(a);
  until(c, () => false, 2000);
  return { c, a, b };
}

describe('durability', () => {
  it('loses an acked record when a follower truncates to its own HW (before KIP-101)', () => {
    const { c, b, followerHw, leader } = quickRestart('high-watermark');
    expect(followerHw).toBe(1);
    expect(leader).toBe(b);
    expect(values(c, b)).toEqual(['m1']);
    expect(c.events.some((e) => e.type === 'truncate' && e.reason === 'hw')).toBe(true);
  });

  it('keeps it with leader epochs (KIP-101)', () => {
    const { c, b, leader } = quickRestart('leader-epoch');
    expect(leader).toBe(b);
    expect(values(c, b)).toEqual(['m1', 'm2']);
  });

  it('lets replicas diverge after a power loss without leader epochs', () => {
    const { c, a, b } = powerLoss('high-watermark');
    expect(values(c, b)).toEqual(['m1', 'm3']);
    expect(values(c, a)).toEqual(['m1', 'm2']);
    expect(c.partition('t', 0).isr).toContain(a); // in sync on paper, different on disk
  });

  it('reconciles them with leader epochs, though the unflushed write is still gone', () => {
    const { c, a, b } = powerLoss('leader-epoch');
    expect(values(c, b)).toEqual(['m1', 'm3']);
    expect(values(c, a)).toEqual(['m1', 'm3']);
    expect(c.events.some((e) => e.type === 'truncate' && e.reason === 'epoch')).toBe(true);
    expect(c.events.some((e) => e.type === 'truncate' && e.reason === 'unflushed')).toBe(true);
  });

  it('flushes the page cache on a schedule and on a clean stop', () => {
    const c = new Cluster({ brokers: 1, flushIntervalMs: 5000 });
    c.createTopic('t', { partitions: 1, replicationFactor: 1 });
    c.produce({ topic: 't', value: 'x', acks: 1 });
    expect(c.dirtyBytes(1)).toBeGreaterThan(0);
    until(c, () => c.dirtyBytes(1) === 0);
    expect(c.events.some((e) => e.type === 'flush')).toBe(true);
    c.produce({ topic: 't', value: 'y', acks: 1 });
    c.stopBroker(1);
    c.startBroker(1);
    expect(values(c, 1)).toEqual(['x', 'y']);
  });

  it('counts redeliveries after a consumer crashes between commits', () => {
    const c = new Cluster({ brokers: 1 });
    c.createTopic('t', { partitions: 1, replicationFactor: 1 });
    const m1 = c.addConsumer({ group: 'g', topics: ['t'], rate: 1000 });
    until(c, () => c.group('g').state === 'Stable');
    c.addConsumer({ group: 'g', topics: ['t'], rate: 1000 });
    until(c, () => c.group('g').state === 'Stable');
    const owner = [...c.group('g').members.values()].find((m) => m.assignment.length > 0);
    c.addProducer({ topic: 't', rate: 50 });
    until(c, () => false, 1700);
    c.crashConsumer('g', owner?.id ?? m1.id);
    until(c, () => c.group('g').members.size === 1);
    until(c, () => false, 3000);
    expect(c.group('g').redelivered).toBeGreaterThan(0);
  });

  it('traces a record from produce to commit to consume', () => {
    const c = new Cluster({ brokers: 3 });
    c.createTopic('t', { partitions: 1, replicationFactor: 3 });
    c.addConsumer({ group: 'g', topics: ['t'], offsetReset: 'earliest', rate: 100 });
    c.produce({ topic: 't', value: 'v' });
    until(c, () => false, 3000);
    const p = c.partition('t', 0);
    const r = c.leaderLog(p)?.read(0)[0];
    const tr = r && c.trace(r);
    expect(tr?.copies.size).toBe(2);
    expect(tr?.committedAt).toBeGreaterThan(0);
    expect(tr?.ackedAt).toBeGreaterThanOrEqual(tr?.committedAt ?? Infinity);
    expect(tr?.consumed.get('g')?.at).toBeGreaterThanOrEqual(tr?.committedAt ?? Infinity);
  });

  it('gives the same history for any frame size', () => {
    const story = (frame: number) => {
      const c = new Cluster({ brokers: 3, seed: 3 });
      c.createTopic('t', { partitions: 3, replicationFactor: 3 });
      c.addProducer({ topic: 't', rate: 25, keys: 'unique' });
      c.addConsumer({ group: 'g', topics: ['t'] });
      for (let t = 0; t < 4000; t += frame) c.tick(frame);
      c.runUntil(4000);
      return JSON.stringify(c.events);
    };
    expect(story(16.7)).toEqual(story(50));
  });
});
