import { describe, expect, it } from 'vitest';
import type { KafkaPartition, KafkaSnapshot } from './snapshot';
import {
  barPosition,
  groupLag,
  produceRates,
  replicaRole,
  replicasByBroker,
  underReplicated,
} from './view';

const part = (id: number, over: Partial<KafkaPartition> = {}): KafkaPartition => ({
  id,
  leader: 1,
  replicas: [1, 2, 3],
  isr: [1, 2, 3],
  offlineReplicas: [],
  logStartOffset: 0,
  highWatermark: 10,
  ...over,
});

const snap = (at: string, hw: number, over: Partial<KafkaPartition> = {}): KafkaSnapshot => ({
  at,
  controller: 1,
  brokers: [1, 2, 3].map((id) => ({ id, host: `kafka-${id}`, rack: null })),
  topics: [
    {
      name: 'lab-orders',
      internal: false,
      configs: {},
      partitions: [part(0, { highWatermark: hw, ...over })],
    },
    { name: '__consumer_offsets', internal: true, configs: {}, partitions: [part(0)] },
  ],
  groups: [
    {
      id: 'billing',
      state: 'Stable',
      protocolType: 'consumer',
      assignor: 'range',
      members: [],
      offsets: [{ topic: 'lab-orders', partition: 0, committed: 4 }],
    },
  ],
});

describe('real cluster view', () => {
  it('names each replica the way its broker sees it', () => {
    const p = part(0, { leader: 2, isr: [2, 3], offlineReplicas: [3] });
    expect([1, 2, 3].map((b) => replicaRole(p, b))).toEqual(['out', 'leader', 'offline']);
  });

  it('lists each broker’s replicas, hiding internal topics unless asked', () => {
    const s = snap('2026-10-10T00:00:00Z', 10);
    expect(replicasByBroker(s, false).get(2)).toEqual([
      { topic: 'lab-orders', partition: 0, role: 'follower' },
    ]);
    expect(replicasByBroker(s, true).get(2)).toHaveLength(2);
  });

  it('counts under-replicated partitions', () => {
    expect(underReplicated(snap('2026-10-10T00:00:00Z', 10, { isr: [1] }))).toBe(1);
  });

  it('measures lag from the committed offset to the high watermark', () => {
    const s = snap('2026-10-10T00:00:00Z', 10);
    expect(groupLag(s.groups[0]!, s.topics)[0]).toMatchObject({
      committed: 4,
      highWatermark: 10,
      lag: 6,
    });
  });

  it('turns high-watermark growth into records per second', () => {
    const rates = produceRates(snap('2026-10-10T00:00:00Z', 10), snap('2026-10-10T00:00:02Z', 16));
    expect(rates.get('lab-orders/0')).toBe(3);
    expect(produceRates(null, snap('2026-10-10T00:00:00Z', 10)).size).toBe(0);
  });

  it('places offsets on the bar from log start to high watermark', () => {
    expect(barPosition(part(0, { logStartOffset: 10, highWatermark: 20 }), 15)).toBe(0.5);
    expect(barPosition(part(0, { highWatermark: 0 }), 0)).toBe(1);
  });
});
