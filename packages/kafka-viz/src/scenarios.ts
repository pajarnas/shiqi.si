// Guided scenarios: short stories played on a real simulated cluster, each step
// an action plus a question to answer before seeing what happens. The stories
// follow the failure cases in KIP-101 and Jack Vanlightly's Kafka loss tests,
// and the consumer-group behaviour in KIP-429. All text lives in
// KAFKA_STRINGS.scenarios under the same ids.
import {
  Cluster,
  partitionForKey,
  type Acl,
  type Partition,
  type TruncationMode,
} from '@shiqi/kafka';
import { anchorId } from './anchors';

export interface ScenarioStep {
  /** Key of this step's text in KAFKA_STRINGS.scenarios.list[scenario].steps. */
  id: string;
  /** Done when the step plays, through the timeline, so a rewind undoes it. */
  act?: (c: Cluster) => void;
  /** Then play until this holds... */
  until?: (c: Cluster) => boolean;
  /** ...or for this long (also the cap for `until`). */
  runMs?: number;
  /** Index of the right option when the step asks for a prediction first. */
  answer?: number;
  /** On-screen things to point at while the step is open (anchor ids). */
  focus?: (c: Cluster) => string[];
  /** Partition to open in the inspector. */
  inspect?: (c: Cluster) => { topic: string; partition: number } | null;
  /** Values for placeholders in the step's text. */
  vars?: (c: Cluster) => Record<string, string | number>;
  /** What must be true once the step has played; the tests hold every story to it. */
  expect?: (c: Cluster) => boolean;
}

export interface Scenario {
  id: ScenarioId;
  /** Builds the starting cluster. Deterministic, like everything else. */
  build: () => Cluster;
  steps: ScenarioStep[];
  /** Where the story comes from. */
  source?: string;
  /** A scenario that retells this one another way (the same story with the fix). */
  next?: ScenarioId;
}

export const SCENARIO_IDS = [
  'first-record',
  'acks-one',
  'min-isr',
  'unclean',
  'kip101-restart-hw',
  'kip101-restart-epoch',
  'kip101-power-hw',
  'kip101-power-epoch',
  'rebalance',
  'crash-vs-leave',
  'keys',
  'retention',
  'acls',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

const DEFAULT_RUN_MS = 20_000;
export const stepRunLimit = (s: ScenarioStep) => s.runMs ?? (s.until ? DEFAULT_RUN_MS : 0);

// ── Helpers ────────────────────────────────────────────────────────────────

const part = (c: Cluster, topic: string, p = 0): Partition => c.partition(topic, p);
const leaderId = (c: Cluster, topic: string, p = 0) => part(c, topic, p).leader ?? -1;
const followerIds = (c: Cluster, topic: string, p = 0) => {
  const x = part(c, topic, p);
  return x.replicas.filter((r) => r !== x.leader);
};
const replicaAnchors = (c: Cluster, topic: string, p = 0) =>
  part(c, topic, p).replicas.map((b) => anchorId.replica(topic, p, b));
const values = (c: Cluster, topic: string, broker: number, p = 0) =>
  part(c, topic, p)
    .logs.get(broker)
    ?.read(0)
    .map((r) => r.value)
    .join(',') ?? '';
const acked = (c: Cluster, producer: string) => c.producers.get(producer)?.acked ?? 0;
const memberByClient = (c: Cluster, group: string, clientId: string) =>
  [...c.group(group).members.values()].find((m) => m.clientId === clientId);
const stable = (c: Cluster, group: string) => c.group(group).state === 'Stable';
const inspect =
  (topic: string, partition = 0) =>
  () => ({ topic, partition });

// ── Basics ─────────────────────────────────────────────────────────────────

const FIRST_KEY = 'alice';

const firstRecord: Scenario = {
  id: 'first-record',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 101 });
    c.createTopic('orders', {
      partitions: 3,
      replicationFactor: 3,
      config: { 'min.insync.replicas': 2 },
    });
    c.addProducer({ id: 'app', topic: 'orders', rate: 0, acks: 'all', keys: 'fixed' });
    return c;
  },
  steps: [
    {
      id: 'cluster',
      focus: (c) => [...c.brokers.keys()].map(anchorId.broker),
    },
    {
      id: 'send',
      answer: 1,
      act: (c) =>
        void c.produce({ topic: 'orders', key: FIRST_KEY, value: 'order #1', producer: 'app' }),
      until: (c) => acked(c, 'app') >= 1,
      focus: (c) => [anchorId.producer('app'), ...replicaAnchors(c, 'orders', firstPartition())],
      inspect: () => ({ topic: 'orders', partition: firstPartition() }),
      vars: () => ({ partition: firstPartition() }),
      expect: (c) => acked(c, 'app') === 1,
    },
    {
      id: 'hw',
      focus: (c) => replicaAnchors(c, 'orders', firstPartition()),
      inspect: () => ({ topic: 'orders', partition: firstPartition() }),
    },
    {
      id: 'read',
      answer: 0,
      act: (c) =>
        void c.addConsumer({
          group: 'billing',
          topics: ['orders'],
          clientId: 'billing-1',
          offsetReset: 'earliest',
          rate: 4,
        }),
      until: (c) => (c.group('billing').processed.get(`orders-${firstPartition()}`) ?? 0) > 0,
      focus: () => [anchorId.group('billing')],
      expect: (c) => c.group('billing').processed.size > 0,
    },
    {
      id: 'commit',
      until: (c) => c.group('billing').committed.has(`orders-${firstPartition()}`),
      runMs: 8000,
      inspect: () => ({ topic: 'orders', partition: firstPartition() }),
      expect: (c) => c.group('billing').committed.get(`orders-${firstPartition()}`) === 1,
    },
  ],
};

function firstPartition() {
  return partitionForKey(FIRST_KEY, 3);
}

// ── Durability: acks, the ISR, unclean election ────────────────────────────

const acksOne: Scenario = {
  id: 'acks-one',
  source: 'vanlightly',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 202 });
    c.createTopic('payments', { partitions: 1, replicationFactor: 3 });
    c.addProducer({ id: 'pay-svc', topic: 'payments', rate: 20, acks: 1 });
    return c;
  },
  steps: [
    {
      id: 'flow',
      runMs: 3000,
      focus: (c) => [anchorId.producer('pay-svc'), ...replicaAnchors(c, 'payments')],
      inspect: inspect('payments'),
    },
    {
      id: 'lag',
      answer: 0,
      act: (c) => followerIds(c, 'payments').forEach((b) => c.setBrokerSlow(b, true)),
      runMs: 3000,
      focus: (c) => followerIds(c, 'payments').map(anchorId.broker),
      expect: (c) => {
        const p = part(c, 'payments');
        const leo = c.leaderLog(p)?.logEndOffset ?? 0;
        return (
          p.isr.length === 3 &&
          followerIds(c, 'payments').every((b) => leo - (p.logs.get(b)?.logEndOffset ?? 0) > 20)
        );
      },
    },
    {
      id: 'crash',
      answer: 1,
      act: (c) => c.stopBroker(leaderId(c, 'payments')),
      runMs: 2000,
      focus: (c) => [anchorId.broker(part(c, 'payments').replicas[0] ?? 0)],
      expect: (c) => part(c, 'payments').leader !== part(c, 'payments').replicas[0],
    },
    {
      id: 'back',
      act: (c) => c.startBroker(part(c, 'payments').replicas[0] ?? 0),
      runMs: 3000,
      vars: (c) => ({ lost: part(c, 'payments').goneAcked }),
      expect: (c) => part(c, 'payments').goneAcked > 20,
    },
    { id: 'lesson' },
  ],
  next: 'min-isr',
};

const minIsr: Scenario = {
  id: 'min-isr',
  source: 'vanlightly',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 303 });
    c.createTopic('ledger', { partitions: 1, replicationFactor: 3 });
    c.addProducer({ id: 'ledger-svc', topic: 'ledger', rate: 10, acks: 'all' });
    return c;
  },
  steps: [
    {
      id: 'healthy',
      runMs: 3000,
      focus: (c) => replicaAnchors(c, 'ledger'),
      inspect: inspect('ledger'),
    },
    {
      id: 'shrink',
      answer: 1,
      act: (c) => followerIds(c, 'ledger').forEach((b) => c.setBrokerSlow(b, true)),
      until: (c) => part(c, 'ledger').isr.length === 1,
      focus: (c) => followerIds(c, 'ledger').map(anchorId.broker),
      expect: (c) => part(c, 'ledger').isr.length === 1,
    },
    {
      id: 'acked',
      runMs: 4000,
      focus: () => [anchorId.producer('ledger-svc')],
      expect: (c) => (c.producers.get('ledger-svc')?.failed ?? 1) === 0,
    },
    {
      id: 'cut',
      answer: 1,
      act: (c) => c.restartBroker(leaderId(c, 'ledger'), { hard: true }),
      runMs: 1000,
      focus: (c) => [anchorId.broker(leaderId(c, 'ledger'))],
      vars: (c) => ({ lost: part(c, 'ledger').goneAcked }),
      expect: (c) => part(c, 'ledger').goneAcked > 0,
    },
    {
      id: 'fix',
      answer: 1,
      act: (c) => c.setTopicConfig('ledger', 'min.insync.replicas', 2),
      runMs: 3000,
      focus: () => [anchorId.producer('ledger-svc')],
      expect: (c) => c.producers.get('ledger-svc')?.lastError === 'NOT_ENOUGH_REPLICAS',
    },
    {
      id: 'heal',
      act: (c) => followerIds(c, 'ledger').forEach((b) => c.setBrokerSlow(b, false)),
      until: (c) => part(c, 'ledger').isr.length === 3,
      runMs: 30_000,
      expect: (c) => part(c, 'ledger').isr.length === 3,
    },
  ],
  next: 'unclean',
};

const unclean: Scenario = {
  id: 'unclean',
  source: 'vanlightly',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 404 });
    c.createTopic('clicks', { partitions: 1, replicationFactor: 3 });
    c.addProducer({ id: 'tracker', topic: 'clicks', rate: 15, acks: 1 });
    return c;
  },
  steps: [
    {
      id: 'shrink',
      act: (c) => followerIds(c, 'clicks').forEach((b) => c.setBrokerSlow(b, true)),
      until: (c) => part(c, 'clicks').isr.length === 1,
      focus: (c) => replicaAnchors(c, 'clicks'),
      inspect: inspect('clicks'),
      expect: (c) => part(c, 'clicks').isr.length === 1,
    },
    {
      id: 'die',
      answer: 1,
      act: (c) => c.stopBroker(leaderId(c, 'clicks')),
      runMs: 2000,
      expect: (c) => part(c, 'clicks').leader === null,
    },
    {
      id: 'allow',
      answer: 1,
      act: (c) => c.setTopicConfig('clicks', 'unclean.leader.election.enable', true),
      runMs: 3000,
      expect: (c) => part(c, 'clicks').leader !== null,
    },
    {
      id: 'back',
      act: (c) => {
        const down = [...c.brokers.values()].find((b) => !b.up);
        if (down) c.startBroker(down.id);
      },
      runMs: 4000,
      vars: (c) => ({ lost: part(c, 'clicks').goneAcked }),
      expect: (c) => part(c, 'clicks').goneAcked > 20,
    },
  ],
};

// ── KIP-101: why leader epochs replaced the high watermark ─────────────────

function kip101Restart(mode: TruncationMode): Scenario {
  const hw = mode === 'high-watermark';
  const a = () => 1; // the leader: replicas are [1, 2] for this seed
  const b = () => 2;
  return {
    id: hw ? 'kip101-restart-hw' : 'kip101-restart-epoch',
    source: 'kip101',
    next: hw ? 'kip101-restart-epoch' : 'kip101-power-hw',
    build: () => {
      const c = new Cluster({ brokers: 2, seed: 505, truncation: mode });
      c.createTopic('events', { partitions: 1, replicationFactor: 2 });
      c.addProducer({ id: 'app', topic: 'events', rate: 0, acks: 'all' });
      return c;
    },
    steps: [
      {
        id: 'm1',
        act: (c) => void c.produce({ topic: 'events', value: 'm1', producer: 'app' }),
        until: (c) => acked(c, 'app') >= 1,
        focus: (c) => replicaAnchors(c, 'events'),
        inspect: inspect('events'),
        expect: (c) => leaderId(c, 'events') === a(),
      },
      {
        id: 'm2',
        answer: 1,
        act: (c) => void c.produce({ topic: 'events', value: 'm2', producer: 'app' }),
        until: (c) => acked(c, 'app') >= 2,
        focus: () => [anchorId.replica('events', 0, b())],
        expect: (c) => part(c, 'events').logs.get(b())?.highWatermark === 1,
      },
      {
        id: 'bounce',
        answer: hw ? 1 : 0,
        act: (c) => c.restartBroker(b()),
        focus: () => [anchorId.replica('events', 0, b())],
        expect: (c) => values(c, 'events', b()) === (hw ? 'm1' : 'm1,m2'),
      },
      {
        id: 'fail',
        answer: hw ? 1 : 0,
        act: (c) => c.stopBroker(a()),
        runMs: 500,
        focus: () => [anchorId.broker(a())],
        expect: (c) => leaderId(c, 'events') === b(),
      },
      {
        id: 'back',
        act: (c) => c.startBroker(a()),
        runMs: 2000,
        vars: (c) => ({ lost: part(c, 'events').goneAcked }),
        expect: (c) =>
          part(c, 'events').goneAcked === (hw ? 1 : 0) &&
          values(c, 'events', a()) === values(c, 'events', b()),
      },
    ],
  };
}

function kip101Power(mode: TruncationMode): Scenario {
  const hw = mode === 'high-watermark';
  const a = () => 1;
  const b = () => 2;
  return {
    id: hw ? 'kip101-power-hw' : 'kip101-power-epoch',
    source: 'kip101',
    next: hw ? 'kip101-power-epoch' : undefined,
    build: () => {
      const c = new Cluster({ brokers: 2, seed: 505, truncation: mode, flushIntervalMs: -1 });
      c.createTopic('events', { partitions: 1, replicationFactor: 2 });
      c.addProducer({ id: 'app', topic: 'events', rate: 0, acks: 'all' });
      return c;
    },
    steps: [
      {
        id: 'm1',
        act: (c) => void c.produce({ topic: 'events', value: 'm1', producer: 'app' }),
        until: (c) => acked(c, 'app') >= 1,
        focus: (c) => replicaAnchors(c, 'events'),
        inspect: inspect('events'),
      },
      {
        id: 'm2',
        act: (c) => {
          c.flushBroker(a());
          c.flushBroker(b());
          c.produce({ topic: 'events', value: 'm2', producer: 'app' });
        },
        until: (c) => acked(c, 'app') >= 2,
        expect: (c) => c.dirtyBytes(b()) > 0,
      },
      {
        id: 'writeback',
        act: (c) => c.flushBroker(a()),
        focus: () => [anchorId.broker(a()), anchorId.broker(b())],
        expect: (c) => c.dirtyBytes(a()) === 0 && c.dirtyBytes(b()) > 0,
      },
      {
        id: 'outage',
        answer: 1,
        act: (c) => {
          c.stopBroker(a(), { hard: true });
          c.stopBroker(b(), { hard: true });
        },
        focus: () => [anchorId.broker(a()), anchorId.broker(b())],
        expect: (c) => values(c, 'events', b()) === 'm1' && values(c, 'events', a()) === 'm1,m2',
      },
      {
        id: 'b-first',
        act: (c) => {
          c.startBroker(b());
          c.produce({ topic: 'events', value: 'm3', producer: 'app' });
        },
        runMs: 500,
        focus: () => [anchorId.replica('events', 0, b())],
        expect: (c) => leaderId(c, 'events') === b() && values(c, 'events', b()) === 'm1,m3',
      },
      {
        id: 'a-back',
        answer: hw ? 0 : 1,
        act: (c) => c.startBroker(a()),
        runMs: 2000,
        focus: () => [anchorId.replica('events', 0, a())],
        expect: (c) => values(c, 'events', a()) === (hw ? 'm1,m2' : 'm1,m3'),
      },
    ],
  };
}

// ── Consumer groups ────────────────────────────────────────────────────────

const rebalance: Scenario = {
  id: 'rebalance',
  source: 'kip429',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 606 });
    c.createTopic('orders', { partitions: 6, replicationFactor: 2 });
    c.addProducer({ id: 'shop', topic: 'orders', rate: 12, acks: 1, keys: 'unique' });
    for (const [group, assignor] of [
      ['eager-app', 'range'],
      ['coop-app', 'cooperative-sticky'],
    ] as const) {
      for (const n of [1, 2]) {
        c.addConsumer({ group, topics: ['orders'], clientId: `${group}-${n}`, rate: 8, assignor });
      }
    }
    return c;
  },
  steps: [
    {
      id: 'steady',
      until: (c) => stable(c, 'eager-app') && stable(c, 'coop-app') && c.now > 4000,
      focus: () => [anchorId.group('eager-app'), anchorId.group('coop-app')],
    },
    {
      id: 'join',
      answer: 1,
      act: (c) => {
        for (const group of ['eager-app', 'coop-app'])
          c.addConsumer({ group, topics: ['orders'], clientId: `${group}-3`, rate: 8 });
      },
      runMs: 3000,
      focus: () => [anchorId.group('eager-app'), anchorId.group('coop-app')],
      expect: (c) =>
        stable(c, 'eager-app') && stable(c, 'coop-app') && c.group('coop-app').members.size === 3,
    },
    { id: 'kip848' },
  ],
};

const crashVsLeave: Scenario = {
  id: 'crash-vs-leave',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 707 });
    c.createTopic('jobs', { partitions: 4, replicationFactor: 2 });
    c.addProducer({ id: 'scheduler', topic: 'jobs', rate: 16, acks: 1, keys: 'unique' });
    for (const n of [1, 2, 3])
      c.addConsumer({ group: 'workers', topics: ['jobs'], clientId: `worker-${n}`, rate: 10 });
    return c;
  },
  steps: [
    {
      id: 'steady',
      until: (c) => stable(c, 'workers') && c.now > 4000,
      focus: () => [anchorId.group('workers')],
    },
    {
      id: 'leave',
      answer: 0,
      act: (c) => {
        const m = memberByClient(c, 'workers', 'worker-3');
        if (m) c.removeConsumer('workers', m.id);
      },
      runMs: 2500,
      focus: () => [anchorId.group('workers')],
      expect: (c) => stable(c, 'workers') && c.group('workers').members.size === 2,
    },
    {
      id: 'crash',
      answer: 1,
      act: (c) => {
        const m = memberByClient(c, 'workers', 'worker-2');
        if (m) c.crashConsumer('workers', m.id);
      },
      until: (c) => c.group('workers').members.size === 1 && stable(c, 'workers'),
      focus: () => [anchorId.group('workers')],
      expect: (c) => c.group('workers').members.size === 1,
    },
    {
      id: 'dupes',
      answer: 1,
      runMs: 3000,
      vars: (c) => ({ n: c.group('workers').redelivered }),
      expect: (c) => c.group('workers').redelivered > 0,
    },
  ],
};

// ── Keys, partitions and the log ───────────────────────────────────────────

const BANK_KEYS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'];

const keys: Scenario = {
  id: 'keys',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 808 });
    c.createTopic('accounts', { partitions: 3, replicationFactor: 2 });
    c.addProducer({
      id: 'bank',
      topic: 'accounts',
      rate: 6,
      acks: 'all',
      keys: 'fixed',
      keySet: BANK_KEYS,
    });
    c.addConsumer({ group: 'auditors', topics: ['accounts'], clientId: 'auditor-1', rate: 10 });
    return c;
  },
  steps: [
    {
      id: 'same-key',
      answer: 1,
      runMs: 4000,
      focus: () => [anchorId.producer('bank')],
      vars: () => ({
        map: BANK_KEYS.map((k) => `${k} → ${partitionForKey(k, 3)}`).join(', '),
      }),
    },
    {
      id: 'grow',
      answer: 1,
      act: (c) => c.addPartitions('accounts', 4),
      runMs: 3000,
      vars: () => ({
        moved:
          BANK_KEYS.filter((k) => partitionForKey(k, 3) !== partitionForKey(k, 4)).join(', ') ||
          '-',
      }),
      expect: (c) => c.topic('accounts').partitions.length === 4,
    },
    {
      id: 'idle',
      answer: 1,
      act: (c) => {
        for (const n of [2, 3, 4, 5])
          c.addConsumer({
            group: 'auditors',
            topics: ['accounts'],
            clientId: `auditor-${n}`,
            rate: 10,
          });
      },
      runMs: 3000,
      focus: () => [anchorId.group('auditors')],
      expect: (c) =>
        stable(c, 'auditors') &&
        [...c.group('auditors').members.values()].filter((m) => m.assignment.length === 0)
          .length === 1,
    },
  ],
};

const retention: Scenario = {
  id: 'retention',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 909 });
    c.createTopic('app-logs', {
      partitions: 1,
      replicationFactor: 2,
      config: { 'retention.ms': 15_000, 'segment.bytes': 600 },
    });
    c.createTopic('profiles', {
      partitions: 1,
      replicationFactor: 2,
      config: { 'cleanup.policy': 'compact', 'segment.bytes': 400, 'delete.retention.ms': 10_000 },
    });
    c.addProducer({ id: 'web', topic: 'app-logs', rate: 8, acks: 1 });
    c.addProducer({
      id: 'profile-svc',
      topic: 'profiles',
      rate: 4,
      acks: 'all',
      keys: 'fixed',
      keySet: ['ann', 'ben', 'cy'],
    });
    c.addConsumer({
      group: 'archiver',
      topics: ['app-logs'],
      clientId: 'archiver',
      rate: 0.5,
      offsetReset: 'earliest',
    });
    return c;
  },
  steps: [
    { id: 'segments', runMs: 6000, inspect: inspect('app-logs') },
    {
      id: 'expire',
      answer: 1,
      until: (c) => c.events.some((e) => e.type === 'offset-reset' && e.group === 'archiver'),
      runMs: 40_000,
      inspect: inspect('app-logs'),
      focus: () => [anchorId.group('archiver')],
      expect: (c) => c.events.some((e) => e.type === 'segment-deleted'),
    },
    {
      id: 'compact',
      answer: 1,
      runMs: 8000,
      inspect: inspect('profiles'),
      expect: (c) => c.events.some((e) => e.type === 'compacted'),
    },
  ],
};

const allow = (
  principal: string,
  resource: Acl['resource'],
  name: string,
  operation: Acl['operation'],
): Acl => ({
  principal,
  resource,
  name,
  pattern: 'literal',
  operation,
  permission: 'Allow',
});
const billing = (c: Cluster) => memberByClient(c, 'billing', 'billing-1');

const acls: Scenario = {
  id: 'acls',
  source: 'acls',
  build: () => {
    const c = new Cluster({ brokers: 3, seed: 909 });
    c.createTopic('orders', { partitions: 2, replicationFactor: 3 });
    c.addProducer({ id: 'checkout', topic: 'orders', rate: 6, acks: 'all', keys: 'fixed' });
    c.addConsumer({ group: 'billing', topics: ['orders'], clientId: 'billing-1', rate: 10 });
    return c;
  },
  steps: [
    {
      id: 'open',
      until: (c) => stable(c, 'billing') && c.now > 3000,
      focus: () => [anchorId.producer('checkout'), anchorId.group('billing')],
    },
    {
      id: 'on',
      answer: 1,
      act: (c) => c.setAuthorizer(true),
      runMs: 3000,
      focus: () => [anchorId.producer('checkout'), anchorId.group('billing')],
      expect: (c) =>
        c.producers.get('checkout')?.lastError === 'TOPIC_AUTHORIZATION_FAILED' &&
        billing(c)?.error === 'GROUP_AUTHORIZATION_FAILED',
    },
    {
      id: 'group',
      answer: 2,
      act: (c) => c.addAcl(allow('User:billing-1', 'group', 'billing', 'Read')),
      until: (c) => stable(c, 'billing') && billing(c)?.error === 'TOPIC_AUTHORIZATION_FAILED',
      focus: () => [anchorId.group('billing')],
      expect: (c) => billing(c)?.error === 'TOPIC_AUTHORIZATION_FAILED',
    },
    {
      id: 'topic',
      act: (c) => {
        c.addAcl(allow('User:billing-1', 'topic', 'orders', 'Read'));
        c.addAcl(allow('User:checkout', 'topic', 'orders', 'Write'));
      },
      runMs: 4000,
      focus: () => [anchorId.producer('checkout'), anchorId.group('billing')],
      expect: (c) => billing(c)?.error === undefined && (billing(c)?.consumed ?? 0) > 0,
    },
    {
      id: 'deny',
      answer: 0,
      act: (c) => c.addAcl({ ...allow('User:*', 'topic', 'orders', 'Write'), permission: 'Deny' }),
      runMs: 3000,
      focus: () => [anchorId.producer('checkout')],
      expect: (c) => c.producers.get('checkout')?.lastError === 'TOPIC_AUTHORIZATION_FAILED',
    },
  ],
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  'first-record': firstRecord,
  'acks-one': acksOne,
  'min-isr': minIsr,
  unclean,
  'kip101-restart-hw': kip101Restart('high-watermark'),
  'kip101-restart-epoch': kip101Restart('leader-epoch'),
  'kip101-power-hw': kip101Power('high-watermark'),
  'kip101-power-epoch': kip101Power('leader-epoch'),
  rebalance,
  'crash-vs-leave': crashVsLeave,
  keys,
  retention,
  acls,
};

/** How the scenarios are listed, in order. */
export const SCENARIO_GROUPS = {
  basics: ['first-record'],
  durability: ['acks-one', 'min-isr', 'unclean'],
  kip101: ['kip101-restart-hw', 'kip101-restart-epoch', 'kip101-power-hw', 'kip101-power-epoch'],
  consumers: ['rebalance', 'crash-vs-leave'],
  log: ['keys', 'retention'],
  security: ['acls'],
} as const satisfies Record<string, readonly ScenarioId[]>;

export const isScenarioId = (id: string | null | undefined): id is ScenarioId =>
  !!id && (SCENARIO_IDS as readonly string[]).includes(id);

/** Sources the scenarios cite, by key: shown under each scenario. */
export const SCENARIO_SOURCES: Record<string, string> = {
  kip101:
    'https://cwiki.apache.org/confluence/display/KAFKA/KIP-101+-+Alter+Replication+Protocol+to+use+Leader+Epoch+rather+than+High+Watermark+for+Truncation',
  vanlightly:
    'https://jack-vanlightly.com/blog/2018/9/14/how-to-lose-messages-on-a-kafka-cluster-part1',
  kip429:
    'https://cwiki.apache.org/confluence/display/KAFKA/KIP-429%3A+Kafka+Consumer+Incremental+Rebalance+Protocol',
};

/** Play a step the way the player does, without a screen: act, then run. */
export function playStep(c: Cluster, step: ScenarioStep) {
  step.act?.(c);
  const limit = c.now + stepRunLimit(step);
  while (c.now < limit && !step.until?.(c)) c.tick(c.settings.tickMs);
}
