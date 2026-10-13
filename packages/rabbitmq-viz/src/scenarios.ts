// Guided stories, played on a real simulated broker. They follow the official
// RabbitMQ tutorials (hello world, work queues, publish/subscribe, routing,
// topics) and the reliability guides (acknowledgements, dead lettering, TTL,
// length limits, alternate exchanges, confirms). All words live in
// RABBIT_STRINGS.scenarios under the same ids.
import { Broker } from '@shiqi/rabbitmq';
import type { LabScenario, LabStep } from '@shiqi/lab';
import { anchorId } from './anchors';

export interface ScenarioStep extends LabStep<Broker> {
  /** Cards to point at while the step is open (anchor ids). */
  focus?: (b: Broker) => string[];
  /** Queue to open in the inspector. */
  inspect?: string;
}

export const SCENARIO_IDS = [
  'hello',
  'work-queue',
  'crash',
  'fanout',
  'direct',
  'topic',
  'unroutable',
  'dead-letter',
  'ttl',
  'max-length',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface Scenario extends LabScenario<Broker, ScenarioId> {
  steps: ScenarioStep[];
}

export const isScenarioId = (s: unknown): s is ScenarioId =>
  typeof s === 'string' && (SCENARIO_IDS as readonly string[]).includes(s);

// ── Helpers ────────────────────────────────────────────────────────────────

const q = anchorId.queue;
const x = anchorId.exchange;
const c = anchorId.consumer;
const p = anchorId.publisher;

/** Publish `n` messages right now from a publisher. */
const send = (b: Broker, publisher: string, n = 1) => {
  for (let i = 0; i < n; i++) b.publishFrom(publisher);
};

/** Nothing waiting, nothing unacked, nothing on the wire: the queue is done. */
const settled = (b: Broker, ...queues: string[]) =>
  queues.every((name) => {
    const queue = b.queues.get(name);
    return queue !== undefined && queue.ready.length === 0 && queue.unacked === 0;
  }) && [...b.consumers.values()].every((k) => b.settlingFrom(k.tag) === 0);

const acked = (b: Broker, name: string) => b.queues.get(name)?.stats.acked ?? 0;
const received = (b: Broker, tag: string) => b.consumers.get(tag)?.stats.received ?? 0;
const bodies = (b: Broker, name: string) => b.queue(name).ready.map((m) => m.body);

/** A publisher that only sends when a step tells it to. */
const manual = (b: Broker, id: string, exchange: string, keys: string[], extra = {}) =>
  b.addPublisher({ id, exchange, keys, rate: 0, ...extra });

// ── Starting worlds ────────────────────────────────────────────────────────

function helloWorld() {
  const b = new Broker();
  b.declareQueue('hello');
  manual(b, 'app', '', ['hello']);
  b.addConsumer({ queue: 'hello', tag: 'worker', prefetch: 1, workMs: 600 });
  return b;
}

function workers(prefetch: number) {
  const b = new Broker();
  b.declareQueue('tasks');
  manual(b, 'app', '', ['tasks']);
  b.addConsumer({ queue: 'tasks', tag: 'worker-1', prefetch, workMs: 400 });
  b.addConsumer({ queue: 'tasks', tag: 'worker-2', prefetch, workMs: 400 });
  return b;
}

function crashWorld() {
  const b = new Broker();
  b.declareQueue('tasks');
  manual(b, 'app', '', ['tasks']);
  b.addConsumer({ queue: 'tasks', tag: 'worker-1', prefetch: 3, workMs: 2500 });
  b.addConsumer({ queue: 'tasks', tag: 'worker-2', prefetch: 3, workMs: 400 });
  return b;
}

function fanoutWorld() {
  const b = new Broker();
  b.declareExchange('logs', 'fanout');
  for (const name of ['screen', 'disk']) {
    b.declareQueue(name);
    b.bind({ source: 'logs', destination: name });
    b.addConsumer({ queue: name, tag: `${name}-reader`, prefetch: 1, workMs: 300 });
  }
  manual(b, 'app', 'logs', ['info']);
  return b;
}

function directWorld() {
  const b = new Broker();
  b.declareExchange('direct_logs', 'direct');
  b.declareQueue('errors');
  b.declareQueue('everything');
  b.bind({ source: 'direct_logs', destination: 'errors', routingKey: 'error' });
  for (const k of ['info', 'warning', 'error'])
    b.bind({ source: 'direct_logs', destination: 'everything', routingKey: k });
  for (const k of ['error', 'info', 'debug']) manual(b, k, 'direct_logs', [k]);
  return b;
}

function topicWorld() {
  const b = new Broker();
  b.declareExchange('topic_logs', 'topic');
  b.declareQueue('Q1');
  b.declareQueue('Q2');
  b.bind({ source: 'topic_logs', destination: 'Q1', routingKey: '*.orange.*' });
  b.bind({ source: 'topic_logs', destination: 'Q2', routingKey: '*.*.rabbit' });
  b.bind({ source: 'topic_logs', destination: 'Q2', routingKey: 'lazy.#' });
  for (const k of [
    'quick.orange.rabbit',
    'lazy.orange.elephant',
    'quick.orange.fox',
    'lazy.brown.fox',
    'quick.brown.fox',
    'lazy.orange.male.rabbit',
  ])
    manual(b, k, 'topic_logs', [k]);
  return b;
}

function shopWorld() {
  const b = new Broker();
  b.declareExchange('orders', 'direct');
  b.declareQueue('paid');
  b.bind({ source: 'orders', destination: 'paid', routingKey: 'paid' });
  manual(b, 'shop', 'orders', ['refund']);
  manual(b, 'careful-shop', 'orders', ['refund'], { mandatory: true });
  return b;
}

function deadLetterWorld() {
  const b = new Broker();
  b.declareExchange('dlx', 'fanout');
  b.declareQueue('dead');
  b.bind({ source: 'dlx', destination: 'dead' });
  b.declareQueue('work', { args: { deadLetterExchange: 'dlx' } });
  manual(b, 'app', '', ['work']);
  b.addConsumer({
    queue: 'work',
    tag: 'picky',
    prefetch: 1,
    workMs: 400,
    failEvery: 3,
    onFail: 'reject',
  });
  return b;
}

function ttlWorld() {
  const b = new Broker();
  b.declareExchange('retry', 'fanout');
  b.declareQueue('tasks');
  b.bind({ source: 'retry', destination: 'tasks' });
  b.declareQueue('wait-3s', { args: { messageTtl: 3000, deadLetterExchange: 'retry' } });
  manual(b, 'app', '', ['wait-3s']);
  b.addConsumer({ queue: 'tasks', tag: 'worker', prefetch: 1, workMs: 300 });
  return b;
}

function maxLengthWorld() {
  const b = new Broker();
  b.declareQueue('buffer', { args: { maxLength: 3 } });
  manual(b, 'app', '', ['buffer']);
  return b;
}

/** The free-play broker: a shop's orders, fanned out by topic, with a dead-letter queue. */
export function demoBroker() {
  const b = new Broker();
  b.declareExchange('orders', 'topic');
  b.declareExchange('dlx', 'fanout');
  b.declareQueue('dead');
  b.bind({ source: 'dlx', destination: 'dead' });
  b.declareQueue('billing', { args: { deadLetterExchange: 'dlx' } });
  b.declareQueue('shipping');
  b.declareQueue('audit', { args: { maxLength: 10 } });
  b.bind({ source: 'orders', destination: 'billing', routingKey: 'order.*' });
  b.bind({ source: 'orders', destination: 'shipping', routingKey: 'order.paid' });
  b.bind({ source: 'orders', destination: 'audit', routingKey: '#' });
  b.addPublisher({
    id: 'shop',
    exchange: 'orders',
    keys: ['order.created', 'order.paid', 'order.created', 'order.cancelled'],
    rate: 1.2,
    confirm: true,
  });
  b.addConsumer({ queue: 'billing', tag: 'billing-1', prefetch: 2, workMs: 900 });
  b.addConsumer({
    queue: 'billing',
    tag: 'billing-2',
    prefetch: 2,
    workMs: 1300,
    failEvery: 6,
    onFail: 'reject',
  });
  b.addConsumer({ queue: 'shipping', tag: 'shipping-1', prefetch: 1, workMs: 1500 });
  b.addConsumer({ queue: 'audit', tag: 'audit-1', prefetch: 5, workMs: 250 });
  return b;
}

// ── The stories ────────────────────────────────────────────────────────────

const LONG = 30_000;

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  hello: {
    id: 'hello',
    build: helloWorld,
    source: 'tutorial1',
    next: 'work-queue',
    steps: [
      { id: 'meet', focus: () => [p('app'), x(''), q('hello'), c('worker')] },
      {
        id: 'send',
        act: (b) => send(b, 'app'),
        until: (b) => acked(b, 'hello') === 1 && settled(b, 'hello'),
        answer: 1,
        inspect: 'hello',
        expect: (b) => acked(b, 'hello') === 1,
      },
      { id: 'why-ack', focus: () => [q('hello'), c('worker')] },
      {
        id: 'stream',
        act: (b) => b.updatePublisher('app', { rate: 2 }),
        runMs: 8000,
        answer: 1,
        inspect: 'hello',
        vars: (b) => ({ waiting: b.queue('hello').ready.length, done: acked(b, 'hello') }),
        expect: (b) => b.queue('hello').ready.length >= 5 && acked(b, 'hello') >= 5,
      },
    ],
  },

  'work-queue': {
    id: 'work-queue',
    build: () => workers(0),
    source: 'tutorial2',
    next: 'crash',
    steps: [
      {
        id: 'round-robin',
        act: (b) => send(b, 'app', 6),
        until: (b) => settled(b, 'tasks') && acked(b, 'tasks') === 6,
        runMs: LONG,
        answer: 1,
        focus: () => [c('worker-1'), c('worker-2')],
        expect: (b) => received(b, 'worker-1') === 3 && received(b, 'worker-2') === 3,
      },
      {
        id: 'slow',
        act: (b) => {
          b.updateConsumer('worker-1', { workMs: 3000 });
          send(b, 'app', 8);
        },
        until: (b) => settled(b, 'tasks') && acked(b, 'tasks') === 14,
        runMs: LONG,
        answer: 0,
        focus: () => [c('worker-1')],
        expect: (b) => received(b, 'worker-1') === 7 && received(b, 'worker-2') === 7,
      },
      {
        id: 'prefetch',
        act: (b) => {
          b.updateConsumer('worker-1', { prefetch: 1 });
          b.updateConsumer('worker-2', { prefetch: 1 });
          send(b, 'app', 8);
        },
        until: (b) => settled(b, 'tasks') && acked(b, 'tasks') === 22,
        runMs: LONG,
        answer: 1,
        focus: () => [c('worker-1'), c('worker-2')],
        vars: (b) => ({ slow: received(b, 'worker-1') - 7, fast: received(b, 'worker-2') - 7 }),
        expect: (b) => received(b, 'worker-2') - 7 >= 3 * (received(b, 'worker-1') - 7),
      },
    ],
  },

  crash: {
    id: 'crash',
    build: crashWorld,
    source: 'acks',
    steps: [
      {
        id: 'fill',
        act: (b) => send(b, 'app', 6),
        runMs: 1200,
        focus: () => [c('worker-1')],
        expect: (b) => b.consumer('worker-1').deliveries.length === 3,
      },
      {
        id: 'kill',
        act: (b) => b.crashConsumer('worker-1'),
        until: (b) => settled(b, 'tasks') && acked(b, 'tasks') === 6,
        runMs: LONG,
        answer: 1,
        inspect: 'tasks',
        expect: (b) =>
          b.consumer('worker-2').stats.acked === 6 &&
          b.events.some((e) => e.type === 'deliver' && e.redelivered),
      },
      {
        id: 'auto-ack',
        act: (b) => {
          b.restartConsumer('worker-1');
          b.updateConsumer('worker-1', { autoAck: true });
          send(b, 'app', 6);
        },
        runMs: 1200,
        focus: () => [c('worker-1')],
        expect: (b) => b.consumer('worker-1').deliveries.length >= 3,
      },
      {
        id: 'kill-auto',
        act: (b) => b.crashConsumer('worker-1'),
        until: (b) => settled(b, 'tasks'),
        runMs: LONG,
        answer: 0,
        vars: (b) => ({ lost: b.consumer('worker-1').stats.lost }),
        expect: (b) => b.consumer('worker-1').stats.lost >= 3,
      },
    ],
  },

  fanout: {
    id: 'fanout',
    build: fanoutWorld,
    source: 'tutorial3',
    next: 'direct',
    steps: [
      { id: 'meet', focus: () => [x('logs')] },
      {
        id: 'send',
        act: (b) => send(b, 'app'),
        until: (b) => acked(b, 'screen') === 1 && acked(b, 'disk') === 1,
        answer: 1,
        focus: () => [x('logs'), q('screen'), q('disk')],
        expect: (b) => acked(b, 'screen') === 1 && acked(b, 'disk') === 1,
      },
      {
        id: 'late',
        act: (b) => {
          b.declareQueue('audit');
          b.bind({ source: 'logs', destination: 'audit' });
          b.addConsumer({ queue: 'audit', tag: 'audit-reader', prefetch: 1, workMs: 300 });
          send(b, 'app');
        },
        until: (b) => acked(b, 'audit') === 1 && acked(b, 'disk') === 2,
        answer: 0,
        focus: () => [q('audit')],
        expect: (b) => acked(b, 'audit') === 1 && acked(b, 'screen') === 2,
      },
    ],
  },

  direct: {
    id: 'direct',
    build: directWorld,
    source: 'tutorial4',
    next: 'topic',
    steps: [
      { id: 'meet', focus: () => [x('direct_logs')] },
      {
        id: 'error',
        act: (b) => send(b, 'error'),
        runMs: 1500,
        answer: 2,
        focus: () => [p('error')],
        expect: (b) =>
          b.queue('errors').ready.length === 1 && b.queue('everything').ready.length === 1,
      },
      {
        id: 'info',
        act: (b) => send(b, 'info'),
        runMs: 1500,
        answer: 1,
        focus: () => [p('info')],
        expect: (b) =>
          b.queue('errors').ready.length === 1 && b.queue('everything').ready.length === 2,
      },
      {
        id: 'debug',
        act: (b) => send(b, 'debug'),
        runMs: 1500,
        answer: 1,
        focus: () => [p('debug'), x('direct_logs')],
        expect: (b) => b.exchange('direct_logs').stats.unroutable === 1,
      },
    ],
  },

  topic: {
    id: 'topic',
    build: topicWorld,
    source: 'tutorial5',
    steps: [
      { id: 'meet', focus: () => [x('topic_logs')] },
      {
        id: 'both',
        act: (b) => send(b, 'quick.orange.rabbit'),
        runMs: 1500,
        answer: 2,
        expect: (b) => b.queue('Q1').ready.length === 1 && b.queue('Q2').ready.length === 1,
      },
      {
        id: 'hash',
        act: (b) => send(b, 'lazy.orange.male.rabbit'),
        runMs: 1500,
        answer: 1,
        expect: (b) => b.queue('Q1').ready.length === 1 && b.queue('Q2').ready.length === 2,
      },
      {
        id: 'none',
        act: (b) => send(b, 'quick.brown.fox'),
        runMs: 1500,
        answer: 0,
        expect: (b) => b.exchange('topic_logs').stats.unroutable === 1,
      },
      {
        id: 'rest',
        act: (b) => {
          send(b, 'lazy.orange.elephant');
          send(b, 'quick.orange.fox');
          send(b, 'lazy.brown.fox');
        },
        runMs: 1500,
        expect: (b) => b.queue('Q1').ready.length === 3 && b.queue('Q2').ready.length === 4,
      },
    ],
  },

  unroutable: {
    id: 'unroutable',
    build: shopWorld,
    source: 'ae',
    steps: [
      {
        id: 'silent',
        act: (b) => send(b, 'shop'),
        runMs: 1500,
        answer: 1,
        focus: () => [p('shop'), x('orders')],
        expect: (b) => b.exchange('orders').stats.unroutable === 1,
      },
      {
        id: 'mandatory',
        act: (b) => send(b, 'careful-shop'),
        runMs: 1500,
        answer: 2,
        focus: () => [p('careful-shop')],
        expect: (b) => b.publisher('careful-shop').stats.returned === 1,
      },
      {
        id: 'alternate',
        act: (b) => {
          b.declareExchange('unrouted', 'fanout');
          b.declareQueue('unrouted');
          b.bind({ source: 'unrouted', destination: 'unrouted' });
          b.deleteExchange('orders');
          b.declareExchange('orders', 'direct', { alternate: 'unrouted' });
          b.bind({ source: 'orders', destination: 'paid', routingKey: 'paid' });
          send(b, 'shop');
        },
        runMs: 1500,
        answer: 1,
        focus: () => [x('orders'), x('unrouted'), q('unrouted')],
        inspect: 'unrouted',
        expect: (b) => b.queue('unrouted').ready.length === 1,
      },
    ],
  },

  'dead-letter': {
    id: 'dead-letter',
    build: deadLetterWorld,
    source: 'dlx',
    next: 'ttl',
    steps: [
      {
        id: 'reject',
        act: (b) => send(b, 'app', 3),
        until: (b) => settled(b, 'work') && b.queue('dead').ready.length === 1,
        runMs: LONG,
        answer: 2,
        inspect: 'dead',
        focus: () => [c('picky'), q('dead')],
        expect: (b) => b.queue('dead').ready[0]?.deaths[0]?.reason === 'rejected',
      },
      {
        id: 'requeue',
        act: (b) => {
          b.updateConsumer('picky', { failEvery: 1, onFail: 'requeue' });
          send(b, 'app');
        },
        runMs: 5000,
        answer: 1,
        inspect: 'work',
        expect: (b) => b.queue('work').stats.redelivered >= 3 && b.queue('dead').ready.length === 1,
      },
      {
        id: 'limit',
        act: (b) => {
          b.deleteQueue('work');
          b.declareQueue('work', {
            args: { type: 'quorum', deliveryLimit: 3, deadLetterExchange: 'dlx' },
          });
          b.addConsumer({
            queue: 'work',
            tag: 'picky',
            prefetch: 1,
            workMs: 400,
            failEvery: 1,
            onFail: 'requeue',
          });
          send(b, 'app');
        },
        until: (b) => b.queue('dead').ready.length === 2,
        runMs: LONG,
        answer: 2,
        inspect: 'dead',
        expect: (b) => b.queue('dead').ready[1]?.deaths[0]?.reason === 'delivery_limit',
      },
    ],
  },

  ttl: {
    id: 'ttl',
    build: ttlWorld,
    source: 'ttl',
    next: 'max-length',
    steps: [
      { id: 'meet', focus: () => [q('wait-3s'), x('retry')] },
      {
        id: 'expire',
        act: (b) => send(b, 'app'),
        until: (b) => acked(b, 'tasks') === 1,
        runMs: 10_000,
        answer: 2,
        focus: () => [q('wait-3s')],
        expect: (b) => acked(b, 'tasks') === 1,
      },
      { id: 'pattern' },
    ],
  },

  'max-length': {
    id: 'max-length',
    build: maxLengthWorld,
    source: 'maxlength',
    steps: [
      {
        id: 'drop-head',
        act: (b) => send(b, 'app', 5),
        runMs: 1500,
        answer: 1,
        inspect: 'buffer',
        expect: (b) => bodies(b, 'buffer').join() === 'app #3,app #4,app #5',
      },
      {
        id: 'reject-publish',
        act: (b) => {
          b.deleteQueue('buffer');
          b.declareQueue('buffer', { args: { maxLength: 3, overflow: 'reject-publish' } });
          b.updatePublisher('app', { confirm: true });
          send(b, 'app', 5);
        },
        runMs: 1500,
        answer: 2,
        focus: () => [p('app')],
        expect: (b) =>
          b.publisher('app').stats.nacked === 2 &&
          bodies(b, 'buffer').join() === 'app #6,app #7,app #8',
      },
    ],
  },
};

export const SCENARIO_GROUPS: Record<'basics' | 'routing' | 'failure', ScenarioId[]> = {
  basics: ['hello', 'work-queue', 'crash'],
  routing: ['fanout', 'direct', 'topic', 'unroutable'],
  failure: ['dead-letter', 'ttl', 'max-length'],
};

export const SCENARIO_SOURCES = {
  tutorial1: 'https://www.rabbitmq.com/tutorials/tutorial-one-javascript',
  tutorial2: 'https://www.rabbitmq.com/tutorials/tutorial-two-javascript',
  tutorial3: 'https://www.rabbitmq.com/tutorials/tutorial-three-javascript',
  tutorial4: 'https://www.rabbitmq.com/tutorials/tutorial-four-javascript',
  tutorial5: 'https://www.rabbitmq.com/tutorials/tutorial-five-javascript',
  acks: 'https://www.rabbitmq.com/docs/confirms',
  ae: 'https://www.rabbitmq.com/docs/ae',
  dlx: 'https://www.rabbitmq.com/docs/dlx',
  ttl: 'https://www.rabbitmq.com/docs/ttl',
  maxlength: 'https://www.rabbitmq.com/docs/maxlength',
} as const;

export type ScenarioSource = keyof typeof SCENARIO_SOURCES;

/** Play a whole scenario headless, step by step (for tests). Returns the step that failed its `expect`. */
export function playScenario(id: ScenarioId): string | null {
  const s = SCENARIOS[id];
  const b = s.build();
  for (const step of s.steps) {
    step.act?.(b);
    const limit = b.now + (step.runMs ?? (step.until ? 20_000 : 0));
    while (b.now < limit && !step.until?.(b)) b.tick(b.settings.tickMs);
    if (step.expect && !step.expect(b)) return step.id;
  }
  return null;
}
