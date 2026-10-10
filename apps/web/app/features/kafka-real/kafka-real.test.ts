import { describe, expect, it, vi } from 'vitest';
import { cachedFor } from '~/lib/memo.server';
import { rateLimiter } from '~/lib/rate-limit.server';
import type { KafkaPort } from './client.server';
import { parseBrokers } from './client.server';
import {
  LAB_TOPICS_MAX,
  createLabTopic,
  produce,
  readRecords,
  readSnapshot,
} from './cluster.server';
import { refusal, withKafka } from './http.server';
import {
  isLabTopic,
  parseCreateTopic,
  parseProduce,
  parseRecordsQuery,
  RECORDS_MAX,
} from './snapshot';

type Port = KafkaPort;
type Meta = Awaited<ReturnType<Port['metadata']>>;

const partition = (partitionIndex: number, leaderId: number, isr = [1, 2, 3]) => ({
  errorCode: 0,
  partitionIndex,
  leaderId,
  leaderEpoch: 0,
  replicaNodes: [1, 2, 3],
  isrNodes: isr,
  offlineReplicas: [1, 2, 3].filter((n) => !isr.includes(n)),
});

const META: Meta = {
  throttleTimeMs: 0,
  clusterId: 'c',
  controllerId: 3,
  brokers: [3, 1, 2].map((nodeId) => ({
    nodeId,
    host: `kafka-${nodeId}`,
    port: 9092,
    rack: `rack-${nodeId}`,
  })),
  topics: [
    {
      errorCode: 0,
      name: 'lab-orders',
      topicId: 'id-orders',
      isInternal: false,
      topicAuthorizedOperations: 0,
      // Out of order on purpose; partition 1 has lost broker 3.
      partitions: [partition(1, 2, [1, 2]), partition(0, 1)],
    },
    {
      errorCode: 0,
      name: '__consumer_offsets',
      topicId: 'id-offsets',
      isInternal: true,
      topicAuthorizedOperations: 0,
      partitions: [partition(0, 3)],
    },
  ],
};

/** Log start 10*p, end 10*p + 5 for every partition. */
const listOffsets: Port['listOffsets'] = async (_broker, topics) => ({
  throttleTimeMs: 0,
  topics: topics.map((t) => ({
    name: t.name,
    partitions: t.partitions.map((p) => ({
      partitionIndex: p.partitionIndex,
      errorCode: 0,
      timestamp: -1n,
      offset: BigInt(10 * p.partitionIndex + (p.timestamp === -2n ? 0 : 5)),
      leaderEpoch: 0,
    })),
  })),
});

function fakePort(overrides: Partial<Port> = {}, admin: Partial<Port['admin']> = {}): Port {
  return {
    metadata: async () => META,
    controller: async () => 2,
    listOffsets,
    producer: { send: vi.fn() } as unknown as Port['producer'],
    reader: { fetch: vi.fn() } as unknown as Port['reader'],
    ...overrides,
    admin: {
      describeConfigs: async ({ resources }: { resources: { resourceName: string }[] }) =>
        resources.map((r) => ({
          resourceType: 2,
          resourceName: r.resourceName,
          configs: [
            { name: 'min.insync.replicas', value: '2', configSource: 4 },
            { name: 'cleanup.policy', value: 'delete', configSource: 5 },
            { name: 'flush.ms', value: '1000', configSource: 5 },
          ],
        })),
      listGroups: async () => new Map([['g1', {}]]),
      describeGroups: async () =>
        new Map([
          [
            'g1',
            {
              id: 'g1',
              state: 'Stable',
              protocolType: 'consumer',
              protocol: 'range',
              members: new Map([
                [
                  'm1',
                  {
                    id: 'm1',
                    clientId: 'app',
                    clientHost: '/10.0.0.5',
                    assignments: new Map([
                      ['lab-orders', { topic: 'lab-orders', partitions: [1, 0] }],
                    ]),
                  },
                ],
              ]),
            },
          ],
        ]),
      listConsumerGroupOffsets: async () => [
        {
          groupId: 'g1',
          topics: [
            {
              name: 'lab-orders',
              partitions: [
                { partitionIndex: 0, committedOffset: 3n },
                { partitionIndex: 1, committedOffset: -1n },
              ],
            },
          ],
        },
      ],
      ...admin,
    } as unknown as Port['admin'],
  };
}

describe('readSnapshot', () => {
  it('builds the documented shape', async () => {
    const snap = await readSnapshot(fakePort(), new Date('2026-10-10T00:00:00Z'));
    expect(snap.at).toBe('2026-10-10T00:00:00.000Z');
    expect(snap.controller).toBe(2);
    expect(snap.brokers).toEqual([
      { id: 1, host: 'kafka-1', rack: 'rack-1' },
      { id: 2, host: 'kafka-2', rack: 'rack-2' },
      { id: 3, host: 'kafka-3', rack: 'rack-3' },
    ]);
    expect(snap.topics.map((t) => [t.name, t.internal])).toEqual([
      ['__consumer_offsets', true],
      ['lab-orders', false],
    ]);
    const orders = snap.topics[1]!;
    // Overridden settings and the key ones; other defaults left out.
    expect(orders.configs).toEqual({ 'min.insync.replicas': '2', 'cleanup.policy': 'delete' });
    expect(orders.partitions).toEqual([
      {
        id: 0,
        leader: 1,
        replicas: [1, 2, 3],
        isr: [1, 2, 3],
        offlineReplicas: [],
        logStartOffset: 0,
        highWatermark: 5,
      },
      {
        id: 1,
        leader: 2,
        replicas: [1, 2, 3],
        isr: [1, 2],
        offlineReplicas: [3],
        logStartOffset: 10,
        highWatermark: 15,
      },
    ]);
    expect(snap.groups).toEqual([
      {
        id: 'g1',
        state: 'Stable',
        protocolType: 'consumer',
        assignor: 'range',
        members: [
          {
            memberId: 'm1',
            clientId: 'app',
            host: '10.0.0.5',
            assignment: [{ topic: 'lab-orders', partitions: [0, 1] }],
          },
        ],
        // Partitions never committed (-1) are left out.
        offsets: [{ topic: 'lab-orders', partition: 0, committed: 3 }],
      },
    ]);
  });

  it('asks each partition leader for its own offsets', async () => {
    const asked = vi.fn(listOffsets);
    await readSnapshot(fakePort({ listOffsets: asked }));
    const hosts = asked.mock.calls.map(([b]) => b.host).sort();
    // Two leaders x (earliest, latest) for lab-orders, one for __consumer_offsets.
    expect(hosts).toEqual(['kafka-1', 'kafka-1', 'kafka-2', 'kafka-2', 'kafka-3', 'kafka-3']);
  });

  it('keeps the offsets a partly failed request did return', async () => {
    const partly: Port['listOffsets'] = async (broker, topics) => {
      const res = await listOffsets(broker, topics);
      if (broker.host !== 'kafka-2') return res;
      res.topics[0]!.partitions[0]!.errorCode = 6;
      throw Object.assign(new Error('NOT_LEADER'), { response: res });
    };
    const snap = await readSnapshot(fakePort({ listOffsets: partly }));
    const p1 = snap.topics[1]!.partitions[1]!;
    expect([p1.logStartOffset, p1.highWatermark]).toEqual([0, 0]);
    expect(snap.topics[1]!.partitions[0]!.highWatermark).toBe(5);
  });

  it('falls back to the metadata controller', async () => {
    const snap = await readSnapshot(fakePort({ controller: async () => null }));
    expect(snap.controller).toBe(3);
  });
});

describe('readRecords', () => {
  const batch = (firstOffset: number, values: string[]) => ({
    firstOffset: BigInt(firstOffset),
    firstTimestamp: 1000n,
    records: values.map((v, i) => ({
      offsetDelta: i,
      timestampDelta: BigInt(i),
      key: i % 2 ? null : Buffer.from(`k${i}`),
      value: Buffer.from(v),
    })),
  });
  const reader = (batches: unknown[]) => ({
    fetch: vi.fn(async (_options: unknown) => ({
      responses: [{ partitions: [{ records: batches }] }],
    })),
  });

  it('defaults to the latest records and skips the start of a batch', async () => {
    const r = reader([batch(0, ['a', 'b', 'c', 'd', 'e'])]);
    const port = fakePort({ reader: r as unknown as Port['reader'] });
    const out = await readRecords(port, {
      topic: 'lab-orders',
      partition: 0,
      from: null,
      limit: 2,
    });
    expect(out).toEqual([
      { offset: 3, key: null, value: 'd', timestamp: 1003 },
      { offset: 4, key: 'k4', value: 'e', timestamp: 1004 },
    ]);
    expect(r.fetch.mock.calls[0]?.[0]).toMatchObject({
      node: 1,
      topics: [{ topicId: 'id-orders', partitions: [{ partition: 0, fetchOffset: 3n }] }],
    });
  });

  it('starts at `from`, clamped to the log start, and stops at `limit`', async () => {
    const r = reader([batch(10, ['a', 'b']), batch(12, ['c', 'd', 'e'])]);
    const port = fakePort({ reader: r as unknown as Port['reader'] });
    const out = await readRecords(port, { topic: 'lab-orders', partition: 1, from: 2, limit: 3 });
    expect(out?.map((x) => [x.offset, x.value])).toEqual([
      [10, 'a'],
      [11, 'b'],
      [12, 'c'],
    ]);
  });

  it('answers [] past the end and null for unknown partitions', async () => {
    const port = fakePort();
    expect(
      await readRecords(port, { topic: 'lab-orders', partition: 0, from: 9, limit: 5 }),
    ).toEqual([]);
    expect(port.reader.fetch).not.toHaveBeenCalled();
    expect(
      await readRecords(port, { topic: 'lab-x', partition: 0, from: null, limit: 5 }),
    ).toBeNull();
    expect(
      await readRecords(port, { topic: 'lab-orders', partition: 7, from: null, limit: 5 }),
    ).toBeNull();
  });
});

describe('writes', () => {
  it('refuses produce to a missing topic or partition', async () => {
    const port = fakePort();
    const msg = { key: null, value: 'v' };
    expect(await produce(port, { topic: 'lab-x', messages: [msg] })).toBe('topic');
    expect(await produce(port, { topic: 'lab-orders', messages: [{ ...msg, partition: 2 }] })).toBe(
      'partition',
    );
    expect(port.producer.send).not.toHaveBeenCalled();
  });

  it('produces and reports offsets as numbers', async () => {
    const send = vi.fn(async () => ({
      offsets: [{ topic: 'lab-orders', partition: 1, offset: 7n }],
    }));
    const port = fakePort({ producer: { send } as unknown as Port['producer'] });
    const out = await produce(port, {
      topic: 'lab-orders',
      messages: [{ key: 'k', value: null, partition: 1 }],
    });
    expect(out).toEqual([{ topic: 'lab-orders', partition: 1, offset: 7 }]);
    expect(send).toHaveBeenCalledWith({
      messages: [{ topic: 'lab-orders', key: 'k', value: undefined, partition: 1 }],
    });
  });

  it('caps the number of lab topics', async () => {
    const many = Array.from({ length: LAB_TOPICS_MAX }, (_, i) => ({
      ...META.topics[0]!,
      name: `lab-t${i}`,
    }));
    const createTopics = vi.fn(async () => []);
    const port = fakePort({ metadata: async () => ({ ...META, topics: many }) }, { createTopics });
    const input = { name: 'lab-new', partitions: 3, replicationFactor: 3, configs: {} };
    expect(await createLabTopic(port, input)).toBe('limit');
    expect(createTopics).not.toHaveBeenCalled();
    expect(await createLabTopic(fakePort({}, { createTopics }), input)).toEqual({
      name: 'lab-new',
      partitions: 3,
      replicationFactor: 3,
    });
  });
});

describe('withKafka', () => {
  it('is a 503 without a cluster or when it fails to answer', async () => {
    const none = await withKafka(async () => new Response('x'), null);
    expect(none.status).toBe(503);
    expect(await none.json()).toEqual({ available: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down = await withKafka(async () => Promise.reject(new Error('ECONNREFUSED')), fakePort());
    expect(down.status).toBe(503);
    const slow = await withKafka(() => new Promise<Response>(() => {}), fakePort(), 10);
    expect(slow.status).toBe(503);
    warn.mockRestore();
  });

  it('passes on what the cluster refused', async () => {
    const nested = Object.assign(new Error('Creating topics failed.'), {
      code: 'PLT_KFK_MULTIPLE',
      errors: [
        Object.assign(new Error('response'), {
          code: 'PLT_KFK_RESPONSE',
          errors: [{ code: 'PLT_KFK_PROTOCOL', apiId: 'TOPIC_ALREADY_EXISTS' }],
        }),
      ],
    });
    expect(refusal(nested)).toBe('TOPIC_ALREADY_EXISTS');
    expect(refusal(new Error('socket hang up'))).toBeNull();
    const res = await withKafka(async () => Promise.reject(nested), fakePort());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ detail: 'TOPIC_ALREADY_EXISTS' });
  });
});

describe('input checks', () => {
  it('only lets lab-* topics through', () => {
    expect(isLabTopic('lab-orders')).toBe(true);
    for (const name of [
      'orders',
      'lab-',
      '__consumer_offsets',
      'lab-a b',
      'lab-' + 'x'.repeat(61),
      3,
    ])
      expect(isLabTopic(name)).toBe(false);
  });

  it('parses records queries', () => {
    const q = (s: string) => parseRecordsQuery(new URLSearchParams(s));
    expect(q('topic=t&partition=0')).toEqual({
      ok: true,
      value: { topic: 't', partition: 0, from: null, limit: 20 },
    });
    expect(q('topic=t&partition=2&from=5&limit=50')).toMatchObject({
      value: { from: 5, limit: RECORDS_MAX },
    });
    expect(q('topic=t&partition=0&limit=51')).toEqual({ ok: false, error: 'limit' });
    expect(q('topic=t&partition=-1')).toEqual({ ok: false, error: 'partition' });
    expect(q('topic=t&partition=0&from=x')).toEqual({ ok: false, error: 'from' });
    expect(q('partition=0')).toEqual({ ok: false, error: 'topic' });
  });

  it('parses topic creation', () => {
    expect(parseCreateTopic({ name: 'lab-a' })).toEqual({
      ok: true,
      value: { name: 'lab-a', partitions: 3, replicationFactor: 3, configs: {} },
    });
    expect(parseCreateTopic({ name: 'lab-a', configs: { 'retention.ms': 60000 } })).toMatchObject({
      value: { configs: { 'retention.ms': '60000' } },
    });
    expect(parseCreateTopic({ name: 'a' })).toEqual({ ok: false, error: 'name' });
    expect(parseCreateTopic({ name: 'lab-a', partitions: 13 })).toEqual({
      ok: false,
      error: 'partitions',
    });
    expect(parseCreateTopic({ name: 'lab-a', replicationFactor: 4 })).toEqual({
      ok: false,
      error: 'replicationFactor',
    });
    expect(
      parseCreateTopic({ name: 'lab-a', configs: { 'unclean.leader.election.enable': 'true' } }),
    ).toEqual({ ok: false, error: 'configs.unclean.leader.election.enable' });
  });

  it('parses produce bodies, single or batched', () => {
    expect(parseProduce({ topic: 'lab-a', value: 'v' })).toEqual({
      ok: true,
      value: { topic: 'lab-a', messages: [{ key: null, value: 'v' }] },
    });
    expect(
      parseProduce({ topic: 'lab-a', messages: [{ key: 'k', value: 'v', partition: 1 }] }),
    ).toMatchObject({ value: { messages: [{ key: 'k', value: 'v', partition: 1 }] } });
    expect(parseProduce({ topic: 'orders', value: 'v' })).toEqual({ ok: false, error: 'topic' });
    expect(parseProduce({ topic: 'lab-a', messages: [] })).toEqual({
      ok: false,
      error: 'messages',
    });
    expect(parseProduce({ topic: 'lab-a', value: 5 })).toEqual({ ok: false, error: 'value' });
    expect(parseProduce({ topic: 'lab-a', value: 'x'.repeat(2001) })).toEqual({
      ok: false,
      error: 'value',
    });
  });

  it('parses KAFKA_BROKERS', () => {
    expect(parseBrokers(' kafka-1:9092, kafka-2:9092 ,bad,')).toEqual([
      { host: 'kafka-1', port: 9092 },
      { host: 'kafka-2', port: 9092 },
    ]);
    expect(parseBrokers(undefined)).toEqual([]);
  });
});

describe('cachedFor', () => {
  it('shares one load within the window and retries after a failure', async () => {
    let t = 0;
    let n = 0;
    const load = vi.fn(async () => {
      n += 1;
      if (n === 2) throw new Error('down');
      return n;
    });
    const get = cachedFor(1000, load, () => t);
    expect(await Promise.all([get(), get()])).toEqual([1, 1]);
    t = 999;
    expect(await get()).toBe(1);
    t = 1000;
    await expect(get()).rejects.toThrow('down');
    expect(await get()).toBe(3);
    expect(load).toHaveBeenCalledTimes(3);
  });
});

describe('rateLimiter', () => {
  it('allows `limit` per window per key', () => {
    let t = 0;
    const limiter = rateLimiter(2, 60_000, () => t);
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([true, true, false]);
    expect(limiter.take('b')).toBe(true);
    t = 60_000;
    expect(limiter.take('a')).toBe(true);
  });
});
