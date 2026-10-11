import { Cluster } from '@shiqi/kafka';
import { describe, expect, it } from 'vitest';
import { BeatFilter, type Beat } from './story';

function record(c: Cluster, ms: number) {
  const filter = new BeatFilter();
  const beats: Beat[] = [];
  const off = c.onEvent((e) => {
    const b = filter.take(e, c);
    if (b) beats.push(b);
  });
  c.tick(ms);
  off();
  return { beats, quiet: filter.quiet };
}

describe('BeatFilter', () => {
  it('tells the happy path of one record in order', () => {
    const c = new Cluster({ brokers: 3, seed: 1 });
    c.createTopic('t', { partitions: 1, replicationFactor: 3 });
    c.addProducer({ id: 'p', topic: 't', rate: 0, acks: 'all' });
    const filter = new BeatFilter();
    const kinds: string[] = [];
    c.onEvent((e) => {
      const b = filter.take(e, c);
      if (b) kinds.push(b.kind);
    });
    c.produce({ topic: 't', key: 'k', value: 'v', producer: 'p' });
    c.tick(2000);
    expect(kinds.slice(0, 5)).toEqual(['produce', 'replicate', 'replicate', 'hw', 'ackOk']);
  });

  it('stops once per kind of steady traffic and counts the rest', () => {
    const c = new Cluster({ brokers: 3, seed: 2 });
    c.createTopic('t', { partitions: 1, replicationFactor: 3 });
    c.addProducer({ id: 'p', topic: 't', rate: 20, acks: 1 });
    const { beats, quiet } = record(c, 5000);
    const produces = beats.filter((b) => b.kind === 'produce');
    expect(produces).toHaveLength(1);
    expect(quiet).toBeGreaterThan(50);
  });

  it('always stops for failures', () => {
    const c = new Cluster({ brokers: 3, seed: 3 });
    c.createTopic('t', { partitions: 1, replicationFactor: 3 });
    const filter = new BeatFilter();
    const kinds: string[] = [];
    c.onEvent((e) => {
      const b = filter.take(e, c);
      if (b) kinds.push(b.kind);
    });
    const leader = c.partition('t', 0).leader ?? 0;
    c.stopBroker(leader);
    c.tick(1000);
    expect(kinds).toContain('brokerDown');
    expect(kinds).toContain('leader');
  });
});
