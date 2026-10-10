import { describe, expect, it } from 'vitest';
import { Cluster } from './cluster';
import { KafkaError } from './types';

const run = (c: Cluster, ms: number, step = 50) => {
  for (let t = 0; t < ms; t += step) c.tick(step);
};

describe('Cluster', () => {
  it('spreads leaders over brokers and replicates to followers', () => {
    const c = new Cluster({ brokers: 3 });
    const t = c.createTopic('orders', { partitions: 3, replicationFactor: 3 });
    expect(new Set(t.partitions.map((p) => p.leader)).size).toBe(3);
    for (const p of t.partitions) expect(new Set(p.replicas).size).toBe(3);

    const { partition, offset } = c.produce({ topic: 'orders', key: 'alice', value: 'hi' });
    expect(offset).toBe(0);
    run(c, 1000);
    const p = c.partition('orders', partition);
    for (const log of p.logs.values()) expect(log.logEndOffset).toBe(1);
    expect(p.highWatermark).toBe(1);
    expect(c.events.some((e) => e.type === 'ack' && !e.error)).toBe(true);
  });

  it('routes keys with murmur2 and rejects bad topics', () => {
    const c = new Cluster({ brokers: 3 });
    c.createTopic('t', { partitions: 6, replicationFactor: 1 });
    const a = c.produce({ topic: 't', key: 'alice', value: '1' }).partition;
    expect(c.produce({ topic: 't', key: 'alice', value: '2' }).partition).toBe(a);
    expect(() => c.createTopic('t')).toThrow(KafkaError);
    expect(() => c.createTopic('x', { replicationFactor: 4 })).toThrow(
      /larger than available brokers: 3/,
    );
    expect(() => c.produce({ topic: 'nope', value: 'v' })).toThrow(/does not exist/);
  });

  it('fails over to an ISR follower when the leader dies, and the old leader rejoins', () => {
    const c = new Cluster({ brokers: 3 });
    c.createTopic('t', { partitions: 1, replicationFactor: 3 });
    const p = c.partition('t', 0);
    for (let i = 0; i < 5; i++) c.produce({ topic: 't', value: `${i}` });
    run(c, 1000);
    const old = p.leader as number;
    c.stopBroker(old);
    expect(p.leader).not.toBe(old);
    expect(p.leader).not.toBeNull();
    expect(p.isr).not.toContain(old);
    expect(p.leaderEpoch).toBe(1);
    c.produce({ topic: 't', value: 'after' });
    c.startBroker(old);
    run(c, 2000);
    expect(p.isr).toContain(old);
    expect(p.logs.get(old)?.logEndOffset).toBe(6);
    expect(c.preferredElection()).toBe(1);
    expect(p.leader).toBe(old);
  });

  it('truncates the diverged tail of an old leader (acks=1 data loss)', () => {
    const c = new Cluster({ brokers: 2 });
    c.createTopic('t', { partitions: 1, replicationFactor: 2 });
    const p = c.partition('t', 0);
    c.produce({ topic: 't', value: 'safe', acks: 1 });
    run(c, 500);
    const old = p.leader as number;
    c.produce({ topic: 't', value: 'lost', acks: 1 }); // the follower hasn't fetched it yet
    c.stopBroker(old);
    c.produce({ topic: 't', value: 'new', acks: 1 });
    c.startBroker(old);
    run(c, 1000);
    const values = p.logs
      .get(old)
      ?.read(0)
      .map((r) => r.value);
    expect(values).toEqual(['safe', 'new']);
    expect(c.events.some((e) => e.type === 'truncate' && e.lost === 1)).toBe(true);
  });

  it('goes offline without unclean election and comes back with the last ISR member', () => {
    const c = new Cluster({ brokers: 2 });
    c.createTopic('t', { partitions: 1, replicationFactor: 2 });
    const p = c.partition('t', 0);
    const [a, b] = p.replicas as [number, number];
    c.stopBroker(b);
    c.stopBroker(a);
    expect(p.leader).toBeNull();
    expect(p.isr).toEqual([a]);
    expect(() => c.produce({ topic: 't', value: 'x', partition: 0 })).toThrow(/no leader/);
    c.startBroker(b); // not in the ISR: stays offline
    expect(p.leader).toBeNull();
    c.startBroker(a);
    expect(p.leader).toBe(a);
  });

  it('enforces min.insync.replicas for acks=all and shrinks the ISR of a slow follower', () => {
    const c = new Cluster({ brokers: 3 });
    c.createTopic('t', {
      partitions: 1,
      replicationFactor: 3,
      config: { 'min.insync.replicas': 3 },
    });
    const p = c.partition('t', 0);
    const slow = p.replicas[2] as number;
    c.setBrokerSlow(slow, true);
    c.addProducer({ topic: 't', rate: 20, acks: 1 });
    run(c, 10_000);
    expect(p.isr).not.toContain(slow);
    expect(() => c.produce({ topic: 't', value: 'x', acks: 'all' })).toThrow(/min.isr/);
    c.setBrokerSlow(slow, false);
    run(c, 3000);
    expect(p.isr).toContain(slow);
  });

  it('rebalances a group across members and tracks lag', () => {
    const c = new Cluster({ brokers: 3 });
    c.createTopic('t', { partitions: 4, replicationFactor: 2 });
    const m1 = c.addConsumer({ group: 'g', topics: ['t'], offsetReset: 'earliest', rate: 1000 });
    run(c, 2000);
    expect(m1.assignment).toHaveLength(4);
    const m2 = c.addConsumer({ group: 'g', topics: ['t'], rate: 1000 });
    const g = c.group('g');
    expect(g.state).toBe('PreparingRebalance');
    run(c, 2000);
    expect(g.state).toBe('Stable');
    expect(m1.assignment).toHaveLength(2);
    expect(m2.assignment).toHaveLength(2);

    c.addProducer({ topic: 't', rate: 20, keys: 'fixed' });
    run(c, 5000);
    const { rows } = c.describeGroup('g');
    expect(rows).toHaveLength(4);
    expect(rows.reduce((s, r) => s + (r.lag ?? 0), 0)).toBeLessThan(40); // committed lags the position by up to one auto-commit interval;

    c.crashConsumer('g', m2.id);
    run(c, 3000);
    expect(g.members.size).toBe(2); // still waiting for session.timeout.ms
    run(c, 8000);
    expect(g.members.size).toBe(1);
    expect(m1.assignment).toHaveLength(4);
  });

  it('resets offsets only for an empty group', () => {
    const c = new Cluster({ brokers: 1 });
    c.createTopic('t', { partitions: 1, replicationFactor: 1 });
    for (let i = 0; i < 10; i++) c.produce({ topic: 't', value: `${i}` });
    run(c, 100);
    const m = c.addConsumer({ group: 'g', topics: ['t'], offsetReset: 'earliest', rate: 1000 });
    run(c, 3000);
    expect(() => c.resetOffsets('g', 't', { to: 'earliest' })).toThrow(/inactive/);
    c.removeConsumer('g', m.id);
    expect(c.describeGroup('g').rows[0]?.currentOffset).toBe(10);
    const plan = c.resetOffsets('g', 't', { shiftBy: -3 });
    expect(plan[0]?.offset).toBe(7);
    c.commitOffsets('g', plan);
    expect(c.describeGroup('g').rows[0]?.lag).toBe(3);
  });

  it('is deterministic for a seed', () => {
    const story = () => {
      const c = new Cluster({ brokers: 3, seed: 7 });
      c.createTopic('t', { partitions: 3, replicationFactor: 2 });
      c.addProducer({ topic: 't', rate: 10 });
      run(c, 3000);
      return c.allPartitions().map((p) => [p.replicas.join(), p.highWatermark].join(':'));
    };
    expect(story()).toEqual(story());
  });
});
