// A RabbitMQ broker in memory: exchanges route messages into queues through
// bindings, queues hand them to consumers within their prefetch window, and
// consumers ack, nack or reject them. Messages and acks take `netMs` to cross
// the network, so there is always something on the wire to look at. Nothing is
// random: the same actions at the same times give the same history.
import { Simulation } from '@shiqi/sim';
import { bindingMatches, type ExchangeType } from './routing';
import {
  BROKER_DEFAULTS,
  DEFAULT_EXCHANGE,
  QUEUE_DEFAULTS,
  RabbitError,
  type Binding,
  type BrokerEvent,
  type BrokerSettings,
  type Consumer,
  type DeathReason,
  type Delivery,
  type Exchange,
  type FailAction,
  type Message,
  type Publisher,
  type Queue,
  type QueueArgs,
} from './types';

const MAX_SENDS_PER_TICK = 200;
const MAX_DELIVERIES_PER_TICK = 100;
/** A message dead-lettered this often is in a loop: drop it. */
const MAX_DEATHS = 50;

/** The exchanges every RabbitMQ broker starts with. */
const BUILTIN_EXCHANGES: [string, ExchangeType][] = [
  [DEFAULT_EXCHANGE, 'direct'],
  ['amq.direct', 'direct'],
  ['amq.fanout', 'fanout'],
  ['amq.topic', 'topic'],
  ['amq.headers', 'headers'],
];

export interface ExchangeOptions {
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  alternate?: string | null;
}

export interface QueueOptions {
  durable?: boolean;
  autoDelete?: boolean;
  args?: Partial<QueueArgs>;
}

export interface BindOptions {
  source: string;
  destination: string;
  destinationType?: 'queue' | 'exchange';
  routingKey?: string;
  args?: Record<string, string>;
}

export interface PublishOptions {
  exchange: string;
  routingKey?: string;
  body?: string;
  headers?: Record<string, string>;
  persistent?: boolean;
  expiration?: number | null;
  mandatory?: boolean;
}

export interface PublisherOptions {
  id?: string;
  exchange: string;
  keys?: string[];
  headers?: Record<string, string>[];
  rate?: number;
  confirm?: boolean;
  mandatory?: boolean;
  persistent?: boolean;
  expiration?: number | null;
  paused?: boolean;
}

export interface ConsumerOptions {
  queue: string;
  tag?: string;
  prefetch?: number;
  autoAck?: boolean;
  workMs?: number;
  failEvery?: number;
  onFail?: FailAction;
  paused?: boolean;
}

export type ConsumerPatch = Partial<
  Pick<Consumer, 'prefetch' | 'workMs' | 'failEvery' | 'onFail' | 'paused' | 'autoAck'>
>;
export type PublisherPatch = Partial<
  Pick<
    Publisher,
    'rate' | 'keys' | 'headers' | 'confirm' | 'mandatory' | 'persistent' | 'expiration' | 'paused'
  >
>;

/** Something on the wire towards the broker. */
type Flight =
  | {
      kind: 'publish';
      arrivesAt: number;
      message: Message;
      publisher: string | null;
      mandatory: boolean;
    }
  | {
      kind: 'settle';
      arrivesAt: number;
      consumer: string;
      delivery: Delivery;
      action: 'ack' | 'requeue' | 'reject';
    };

export class Broker extends Simulation<BrokerEvent> {
  readonly settings: BrokerSettings;
  exchanges = new Map<string, Exchange>();
  queues = new Map<string, Queue>();
  bindings: Binding[] = [];
  publishers = new Map<string, Publisher>();
  consumers = new Map<string, Consumer>();

  private wire: Flight[] = [];
  private credit = new Map<string, number>();
  private counters = { message: 0, tag: 0, publisher: 0, consumer: 0, queue: 0 };

  constructor(settings: Partial<BrokerSettings> = {}) {
    super();
    this.settings = { ...BROKER_DEFAULTS, ...settings };
    for (const [name, type] of BUILTIN_EXCHANGES)
      this.exchanges.set(name, newExchange(name, type, { durable: true }, true));
  }

  protected override get stepMs() {
    return this.settings.tickMs;
  }

  configure(patch: Partial<BrokerSettings>) {
    Object.assign(this.settings, patch);
    this.changed();
  }

  // ── Lookups ──────────────────────────────────────────────────────────────

  exchange(name: string): Exchange {
    const x = this.exchanges.get(name);
    if (!x) throw new RabbitError('NOT_FOUND', `no exchange '${name}' in vhost '/'`);
    return x;
  }

  queue(name: string): Queue {
    const q = this.queues.get(name);
    if (!q) throw new RabbitError('NOT_FOUND', `no queue '${name}' in vhost '/'`);
    return q;
  }

  consumer(tag: string): Consumer {
    const c = this.consumers.get(tag);
    if (!c) throw new RabbitError('NOT_FOUND', `no consumer '${tag}'`);
    return c;
  }

  publisher(id: string): Publisher {
    const p = this.publishers.get(id);
    if (!p) throw new RabbitError('NOT_FOUND', `no publisher '${id}'`);
    return p;
  }

  /** Bindings out of an exchange. The default exchange's implicit ones are not listed. */
  bindingsFrom(exchange: string) {
    return this.bindings.filter((b) => b.source === exchange);
  }

  /** Bindings into a queue (or exchange). */
  bindingsTo(destination: string, type: 'queue' | 'exchange' = 'queue') {
    return this.bindings.filter((b) => b.destination === destination && b.destinationType === type);
  }

  /** Messages a publisher has sent that are still on their way to the broker. */
  inFlightFrom(publisher: string) {
    return this.wire.filter((f) => f.kind === 'publish' && f.publisher === publisher).length;
  }

  /** Acks, nacks and rejects a consumer has sent that the broker hasn't got yet. */
  settlingFrom(consumer: string) {
    return this.wire.filter((f) => f.kind === 'settle' && f.consumer === consumer).length;
  }

  /** Deliveries not yet settled as the broker sees it: what prefetch limits. */
  unsettled(c: Consumer) {
    return c.deliveries.length + this.settlingFrom(c.tag);
  }

  // ── Exchanges ────────────────────────────────────────────────────────────

  declareExchange(name: string, type: ExchangeType, options: ExchangeOptions = {}) {
    const old = this.exchanges.get(name);
    if (old) {
      if (old.type !== type)
        throw new RabbitError(
          'PRECONDITION_FAILED',
          `inequivalent arg 'type' for exchange '${name}': received '${type}' but current is '${old.type}'`,
        );
      return old;
    }
    if (name.startsWith('amq.'))
      throw new RabbitError(
        'ACCESS_REFUSED',
        `exchange name '${name}' contains reserved prefix 'amq.*'`,
      );
    const x = newExchange(name, type, options, false);
    this.exchanges.set(name, x);
    this.emit({ type: 'declare', at: this.now, kind: 'exchange', name });
    this.changed();
    return x;
  }

  deleteExchange(name: string) {
    const x = this.exchange(name);
    if (x.builtin)
      throw new RabbitError(
        'ACCESS_REFUSED',
        `operation not permitted on the default exchange or amq.*`,
      );
    this.exchanges.delete(name);
    this.bindings = this.bindings.filter(
      (b) => b.source !== name && !(b.destinationType === 'exchange' && b.destination === name),
    );
    this.emit({ type: 'delete', at: this.now, kind: 'exchange', name });
    this.changed();
  }

  // ── Queues ───────────────────────────────────────────────────────────────

  declareQueue(name: string, options: QueueOptions = {}) {
    const args: QueueArgs = { ...QUEUE_DEFAULTS, ...options.args };
    const old = this.queues.get(name);
    if (old) {
      for (const k of Object.keys(args) as (keyof QueueArgs)[])
        if (options.args && k in options.args && old.args[k] !== args[k])
          throw new RabbitError(
            'PRECONDITION_FAILED',
            `inequivalent arg '${ARG_NAMES[k]}' for queue '${name}': received '${args[k]}' but current is '${old.args[k]}'`,
          );
      return old;
    }
    if (args.type === 'quorum' && options.durable === false)
      throw new RabbitError('PRECONDITION_FAILED', `quorum queues must be durable`);
    const qname = name || `amq.gen-${(++this.counters.queue).toString(36).padStart(4, '0')}`;
    if (qname.startsWith('amq.') && name)
      throw new RabbitError(
        'ACCESS_REFUSED',
        `queue name '${name}' contains reserved prefix 'amq.*'`,
      );
    const q: Queue = {
      name: qname,
      durable: options.durable ?? true,
      autoDelete: options.autoDelete ?? false,
      args,
      ready: [],
      unacked: 0,
      consumers: [],
      next: 0,
      stats: { enqueued: 0, delivered: 0, acked: 0, redelivered: 0, deadLettered: 0, dropped: 0 },
    };
    this.queues.set(qname, q);
    this.emit({ type: 'declare', at: this.now, kind: 'queue', name: qname });
    this.changed();
    return q;
  }

  deleteQueue(name: string) {
    const q = this.queue(name);
    for (const tag of [...q.consumers]) {
      const c = this.consumers.get(tag);
      if (c) this.dropConsumer(c, 'cancel');
      this.consumers.delete(tag);
      this.emit({ type: 'consumer-cancel', at: this.now, consumer: tag, queue: name });
    }
    for (const c of this.consumers.values()) if (c.queue === name) this.consumers.delete(c.tag);
    this.queues.delete(name);
    this.bindings = this.bindings.filter(
      (b) => !(b.destinationType === 'queue' && b.destination === name),
    );
    this.emit({ type: 'delete', at: this.now, kind: 'queue', name });
    this.changed();
  }

  /** Remove every ready message. Unacked ones stay with their consumers. */
  purgeQueue(name: string) {
    const q = this.queue(name);
    const count = q.ready.length;
    q.ready = [];
    this.emit({ type: 'purge', at: this.now, queue: name, count });
    this.changed();
    return count;
  }

  /**
   * basic.get, `count` times: take messages without subscribing. With
   * `requeue` they all go back to the head afterwards, marked redelivered
   * (what rabbitmqadmin's ack_requeue_true does). Returns copies.
   */
  getMessages(name: string, count = 1, requeue = false): Message[] {
    const q = this.queue(name);
    const got = q.ready.splice(0, Math.max(0, count));
    for (const m of got) {
      m.deliveries++;
      q.stats.delivered++;
      this.emit({ type: 'get', at: this.now, id: m.id, queue: name, requeue });
    }
    const copies = got.map((m) => ({ ...m, headers: { ...m.headers }, deaths: [...m.deaths] }));
    if (requeue) {
      for (const m of got) m.redelivered = true;
      q.ready.unshift(...got);
      q.stats.redelivered += got.length;
    } else {
      q.stats.acked += got.length;
    }
    this.changed();
    return copies;
  }

  // ── Bindings ─────────────────────────────────────────────────────────────

  bind(options: BindOptions) {
    const b: Binding = {
      source: options.source,
      destination: options.destination,
      destinationType: options.destinationType ?? 'queue',
      routingKey: options.routingKey ?? '',
      args: options.args ?? {},
    };
    if (b.source === DEFAULT_EXCHANGE)
      throw new RabbitError('ACCESS_REFUSED', `operation not permitted on the default exchange`);
    this.exchange(b.source);
    if (b.destinationType === 'queue') this.queue(b.destination);
    else this.exchange(b.destination);
    if (!this.bindings.some((x) => sameBinding(x, b))) {
      this.bindings.push(b);
      this.emit({ type: 'declare', at: this.now, kind: 'binding', name: bindingName(b) });
      this.changed();
    }
    return b;
  }

  unbind(options: BindOptions) {
    const b: Binding = {
      source: options.source,
      destination: options.destination,
      destinationType: options.destinationType ?? 'queue',
      routingKey: options.routingKey ?? '',
      args: options.args ?? {},
    };
    const before = this.bindings.length;
    this.bindings = this.bindings.filter((x) => !sameBinding(x, b));
    if (this.bindings.length === before)
      throw new RabbitError('NOT_FOUND', `no binding ${bindingName(b)}`);
    this.emit({ type: 'delete', at: this.now, kind: 'binding', name: bindingName(b) });
    const x = this.exchanges.get(b.source);
    if (x?.autoDelete && !this.bindingsFrom(x.name).length) this.deleteExchange(x.name);
    this.changed();
  }

  // ── Publishing ───────────────────────────────────────────────────────────

  /** basic.publish from a one-off client (the CLI, a form). Returns the message id. */
  publish(options: PublishOptions): number {
    const x = this.exchange(options.exchange);
    if (x.internal)
      throw new RabbitError('ACCESS_REFUSED', `cannot publish to internal exchange '${x.name}'`);
    const m = this.newMessage({
      body: options.body ?? '',
      exchange: options.exchange,
      routingKey: options.routingKey ?? '',
      headers: options.headers ?? {},
      persistent: options.persistent ?? true,
      expiration: options.expiration ?? null,
      publisher: null,
    });
    this.send(m, null, options.mandatory ?? false);
    this.changed();
    return m.id;
  }

  addPublisher(options: PublisherOptions): Publisher {
    const id = options.id ?? `pub-${++this.counters.publisher}`;
    if (this.publishers.has(id))
      throw new RabbitError('PRECONDITION_FAILED', `publisher '${id}' exists`);
    this.exchange(options.exchange);
    const p: Publisher = {
      id,
      exchange: options.exchange,
      keys: options.keys?.length ? [...options.keys] : [''],
      headers: options.headers ? options.headers.map((h) => ({ ...h })) : [],
      rate: options.rate ?? 1,
      confirm: options.confirm ?? false,
      mandatory: options.mandatory ?? false,
      persistent: options.persistent ?? true,
      expiration: options.expiration ?? null,
      paused: options.paused ?? false,
      stats: { sent: 0, confirmed: 0, nacked: 0, returned: 0 },
    };
    this.publishers.set(id, p);
    this.changed();
    return p;
  }

  updatePublisher(id: string, patch: PublisherPatch) {
    const p = this.publisher(id);
    Object.assign(p, patch);
    if (!p.keys.length) p.keys = [''];
    this.changed();
  }

  removePublisher(id: string) {
    this.publisher(id);
    this.publishers.delete(id);
    this.credit.delete(id);
    this.changed();
  }

  /** One message from a publisher, now (the "send one" button). */
  publishFrom(id: string) {
    const p = this.publisher(id);
    this.sendFrom(p);
    this.changed();
  }

  private sendFrom(p: Publisher) {
    const x = this.exchanges.get(p.exchange);
    if (!x || x.internal) {
      // A real channel would be closed by the broker; the publisher stops.
      p.paused = true;
      return;
    }
    const n = p.stats.sent;
    const key = p.keys[n % p.keys.length] ?? '';
    const headers = p.headers.length ? { ...p.headers[n % p.headers.length] } : {};
    const m = this.newMessage({
      body: `${p.id} #${n + 1}`,
      exchange: p.exchange,
      routingKey: key,
      headers,
      persistent: p.persistent,
      expiration: p.expiration,
      publisher: p.id,
    });
    p.stats.sent++;
    this.send(m, p.id, p.mandatory);
  }

  private newMessage(
    m: Pick<
      Message,
      'body' | 'exchange' | 'routingKey' | 'headers' | 'persistent' | 'expiration' | 'publisher'
    >,
  ): Message {
    return {
      ...m,
      id: ++this.counters.message,
      publishedAt: this.now,
      enqueuedAt: this.now,
      redelivered: false,
      deliveries: 0,
      deaths: [],
    };
  }

  private send(m: Message, publisher: string | null, mandatory: boolean) {
    this.emit({
      type: 'publish',
      at: this.now,
      id: m.id,
      publisher,
      exchange: m.exchange,
      key: m.routingKey,
    });
    this.wire.push({
      kind: 'publish',
      arrivesAt: this.now + this.settings.netMs,
      message: m,
      publisher,
      mandatory,
    });
  }

  /** A published message reaches the broker: route it, then confirm or return it. */
  private arrive(f: Extract<Flight, { kind: 'publish' }>) {
    const m = f.message;
    const p = f.publisher ? this.publishers.get(f.publisher) : undefined;
    if (!this.exchanges.has(m.exchange)) {
      // The exchange was deleted while the message was on its way: channel error.
      if (p) {
        p.paused = true;
        if (p.confirm) this.confirm(p, m.id, false);
      }
      this.emit({
        type: 'unroutable',
        at: this.now,
        id: m.id,
        exchange: m.exchange,
        key: m.routingKey,
        publisher: f.publisher,
        outcome: 'dropped',
      });
      return;
    }
    const { queues, rejected } = this.routeAndEnqueue(m, m.exchange, f.publisher, f.mandatory);
    if (!queues.length && f.mandatory && p) p.stats.returned++;
    if (p?.confirm) this.confirm(p, m.id, !rejected);
  }

  private confirm(p: Publisher, id: number, ok: boolean) {
    if (ok) p.stats.confirmed++;
    else p.stats.nacked++;
    this.emit({ type: 'confirm', at: this.now, id, publisher: p.id, ok });
  }

  /** The queues an exchange sends a message to, following exchange bindings and alternates. */
  route(exchange: string, key: string, headers: Record<string, string> = {}) {
    const queues = new Set<string>();
    const via: string[] = [];
    const seen = new Set<string>();
    const visit = (name: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      const x = this.exchanges.get(name);
      if (!x) return;
      let matched = false;
      if (name === DEFAULT_EXCHANGE) {
        if (this.queues.has(key)) {
          queues.add(key);
          matched = true;
        }
      } else {
        for (const b of this.bindings) {
          if (b.source !== name || !bindingMatches(x.type, b, key, headers)) continue;
          matched = true;
          if (b.destinationType === 'queue') queues.add(b.destination);
          else {
            via.push(b.destination);
            visit(b.destination);
          }
        }
      }
      if (!matched && x.alternate && this.exchanges.has(x.alternate)) {
        via.push(x.alternate);
        visit(x.alternate);
      }
    };
    visit(exchange);
    return { queues: [...queues], via };
  }

  private routeAndEnqueue(
    m: Message,
    exchange: string,
    publisher: string | null,
    mandatory: boolean,
  ) {
    const x = this.exchange(exchange);
    x.stats.in++;
    const { queues, via } = this.route(exchange, m.routingKey, m.headers);
    if (!queues.length) {
      x.stats.unroutable++;
      this.emit({
        type: 'unroutable',
        at: this.now,
        id: m.id,
        exchange,
        key: m.routingKey,
        publisher,
        outcome: mandatory ? 'returned' : 'dropped',
      });
      return { queues, rejected: false };
    }
    x.stats.routed++;
    this.emit({
      type: 'route',
      at: this.now,
      id: m.id,
      exchange,
      key: m.routingKey,
      queues,
      via,
    });
    let rejected = false;
    for (const name of queues) {
      const q = this.queues.get(name);
      if (!q) continue;
      const copy: Message = { ...m, headers: { ...m.headers }, deaths: [...m.deaths] };
      if (!this.enqueue(q, copy, publisher)) rejected = true;
    }
    return { queues, rejected };
  }

  /** Put a message at the tail, making room as x-overflow says. False when it was refused. */
  private enqueue(q: Queue, m: Message, publisher: string | null): boolean {
    const max = q.args.maxLength;
    if (max !== null && q.ready.length >= max) {
      if (q.args.overflow === 'reject-publish') {
        this.emit({ type: 'reject-publish', at: this.now, id: m.id, queue: q.name, publisher });
        return false;
      }
      while (q.ready.length >= max && q.ready.length > 0) {
        const head = q.ready.shift() as Message;
        this.deadLetter(q, head, 'maxlen');
      }
      if (max === 0) {
        this.deadLetter(q, m, 'maxlen');
        return true;
      }
    }
    m.enqueuedAt = this.now;
    q.ready.push(m);
    q.stats.enqueued++;
    return true;
  }

  /** A message leaves a queue unhappily: to the dead-letter exchange if there is one, else gone. */
  private deadLetter(q: Queue, m: Message, reason: DeathReason) {
    const dlx = q.args.deadLetterExchange;
    if (dlx === null || !this.exchanges.has(dlx) || m.deaths.length >= MAX_DEATHS) {
      q.stats.dropped++;
      this.emit({ type: 'drop', at: this.now, id: m.id, queue: q.name, reason });
      return;
    }
    q.stats.deadLettered++;
    const key = q.args.deadLetterRoutingKey ?? m.routingKey;
    const deaths = [...m.deaths];
    const old = deaths.findIndex((d) => d.queue === q.name && d.reason === reason);
    const death = {
      queue: q.name,
      reason,
      exchange: m.exchange,
      routingKey: m.routingKey,
      count: old >= 0 ? (deaths[old] as { count: number }).count + 1 : 1,
      time: this.now,
    };
    // x-death lists the most recent death first.
    if (old >= 0) deaths.splice(old, 1);
    deaths.unshift(death);
    const next: Message = {
      ...m,
      exchange: dlx,
      routingKey: key,
      redelivered: false,
      deliveries: 0,
      deaths,
    };
    this.emit({
      type: 'dead-letter',
      at: this.now,
      id: m.id,
      queue: q.name,
      exchange: dlx,
      key,
      reason,
    });
    this.routeAndEnqueue(next, dlx, null, false);
  }

  // ── Consumers ────────────────────────────────────────────────────────────

  /** basic.consume: subscribe to a queue. */
  addConsumer(options: ConsumerOptions): Consumer {
    const q = this.queue(options.queue);
    const tag = options.tag ?? `ctag-${++this.counters.consumer}`;
    if (this.consumers.has(tag))
      throw new RabbitError('COMMAND_INVALID', `consumer tag '${tag}' is in use`);
    const c: Consumer = {
      tag,
      queue: q.name,
      prefetch: options.prefetch ?? 0,
      autoAck: options.autoAck ?? false,
      workMs: options.workMs ?? 500,
      failEvery: options.failEvery ?? 0,
      onFail: options.onFail ?? 'requeue',
      paused: options.paused ?? false,
      down: false,
      deliveries: [],
      handled: 0,
      stats: { received: 0, acked: 0, nacked: 0, rejected: 0, lost: 0 },
    };
    this.consumers.set(tag, c);
    this.attach(q, c);
    this.changed();
    return c;
  }

  updateConsumer(tag: string, patch: ConsumerPatch) {
    const c = this.consumer(tag);
    Object.assign(c, patch);
    this.changed();
  }

  /** basic.cancel: unsubscribe cleanly; what it hasn't acked goes back to the queue. */
  removeConsumer(tag: string) {
    const c = this.consumer(tag);
    if (!c.down) this.dropConsumer(c, 'cancel');
    this.consumers.delete(tag);
    this.emit({ type: 'consumer-cancel', at: this.now, consumer: tag, queue: c.queue });
    this.autoDelete(c.queue);
    this.changed();
  }

  /**
   * The consumer's connection dies (process killed, network gone). Everything
   * it hadn't acked, and acks still on the wire, go back to the queue marked
   * redelivered. With auto-ack there is nothing to give back: those are lost.
   */
  crashConsumer(tag: string) {
    const c = this.consumer(tag);
    if (c.down) return;
    const { requeued, lost } = this.dropConsumer(c, 'crash');
    c.down = true;
    this.emit({
      type: 'consumer-down',
      at: this.now,
      consumer: tag,
      queue: c.queue,
      requeued,
      lost,
    });
    this.changed();
  }

  /** Reconnect a crashed consumer: it subscribes again, at the back of the line. */
  restartConsumer(tag: string) {
    const c = this.consumer(tag);
    if (!c.down) return;
    const q = this.queue(c.queue);
    c.down = false;
    c.deliveries = [];
    this.attach(q, c);
    this.emit({ type: 'consumer-up', at: this.now, consumer: tag, queue: c.queue });
    this.changed();
  }

  private attach(q: Queue, c: Consumer) {
    q.consumers.push(c.tag);
    if (q.args.singleActiveConsumer && q.consumers.length === 1)
      this.emit({ type: 'active-consumer', at: this.now, consumer: c.tag, queue: q.name });
  }

  /** Take a consumer off its queue and give back what it holds. */
  private dropConsumer(c: Consumer, reason: 'crash' | 'cancel') {
    const q = this.queues.get(c.queue);
    let requeued = 0;
    let lost = 0;
    const settling = this.wire.filter(
      (f): f is Extract<Flight, { kind: 'settle' }> => f.kind === 'settle' && f.consumer === c.tag,
    );
    // A cancel lets acks already sent arrive; a crash loses them with the connection.
    if (reason === 'crash')
      this.wire = this.wire.filter((f) => !(f.kind === 'settle' && f.consumer === c.tag));
    const giveBack = [
      ...c.deliveries,
      ...(reason === 'crash' ? settling.map((f) => f.delivery) : []),
    ].sort((a, b) => a.tag - b.tag);
    c.deliveries = [];
    if (q) {
      if (c.autoAck) {
        lost = giveBack.length;
        c.stats.lost += lost;
      } else {
        // Back to the head, in their original order.
        for (const d of [...giveBack].reverse()) {
          q.unacked--;
          if (this.requeue(q, d.message, reason)) requeued++;
        }
      }
      const i = q.consumers.indexOf(c.tag);
      if (i >= 0) {
        q.consumers.splice(i, 1);
        if (q.next > i) q.next--;
        if (q.args.singleActiveConsumer && i === 0 && q.consumers[0])
          this.emit({
            type: 'active-consumer',
            at: this.now,
            consumer: q.consumers[0],
            queue: q.name,
          });
      }
    }
    return { requeued, lost };
  }

  /** Put a message back at the head. False when the delivery limit sends it away instead. */
  private requeue(q: Queue, m: Message, reason: 'nack' | 'crash' | 'cancel'): boolean {
    if (q.args.deliveryLimit !== null && m.deliveries > q.args.deliveryLimit) {
      this.deadLetter(q, m, 'delivery_limit');
      return false;
    }
    m.redelivered = true;
    q.ready.unshift(m);
    q.stats.redelivered++;
    this.emit({ type: 'requeue', at: this.now, id: m.id, queue: q.name, reason });
    return true;
  }

  private autoDelete(queue: string) {
    const q = this.queues.get(queue);
    if (q?.autoDelete && !q.consumers.length) this.deleteQueue(queue);
  }

  // ── Time ─────────────────────────────────────────────────────────────────

  protected override step(ms: number) {
    for (const p of this.publishers.values()) {
      if (p.paused) continue;
      let credit = (this.credit.get(p.id) ?? 0) + (p.rate * ms) / 1000;
      let n = Math.min(Math.floor(credit), MAX_SENDS_PER_TICK);
      credit -= Math.floor(credit);
      this.credit.set(p.id, credit);
      while (n-- > 0 && !p.paused) this.sendFrom(p);
    }

    // Things reaching the broker, in the order they were sent.
    const due = this.wire.filter((f) => f.arrivesAt <= this.now);
    if (due.length) {
      this.wire = this.wire.filter((f) => f.arrivesAt > this.now);
      for (const f of due) {
        if (f.kind === 'publish') this.arrive(f);
        else this.settle(f);
      }
    }

    for (const q of this.queues.values()) this.expire(q);
    for (const q of this.queues.values()) this.dispatch(q);
    for (const c of this.consumers.values()) this.work(c);
  }

  /** Messages past their TTL leave from the head (RabbitMQ only expires at the head). */
  private expire(q: Queue) {
    while (q.ready.length) {
      const m = q.ready[0] as Message;
      const ttls = [q.args.messageTtl, m.expiration].filter((t): t is number => t !== null);
      if (!ttls.length || this.now < m.enqueuedAt + Math.min(...ttls)) break;
      q.ready.shift();
      this.deadLetter(q, m, 'expired');
    }
  }

  /** Hand ready messages to consumers in turn, as far as each one's prefetch allows. */
  private dispatch(q: Queue) {
    let budget = MAX_DELIVERIES_PER_TICK;
    while (q.ready.length && budget-- > 0) {
      const c = this.nextConsumer(q);
      if (!c) return;
      const m = q.ready.shift() as Message;
      m.deliveries++;
      q.stats.delivered++;
      const d: Delivery = {
        tag: ++this.counters.tag,
        message: m,
        queue: q.name,
        arrivesAt: this.now + this.settings.netMs,
        doneAt: null,
      };
      c.deliveries.push(d);
      c.stats.received++;
      if (!c.autoAck) q.unacked++;
      else q.stats.acked++;
      this.emit({
        type: 'deliver',
        at: this.now,
        id: m.id,
        tag: d.tag,
        queue: q.name,
        consumer: c.tag,
        redelivered: m.redelivered,
      });
    }
  }

  private nextConsumer(q: Queue): Consumer | null {
    const tags = q.args.singleActiveConsumer ? q.consumers.slice(0, 1) : q.consumers;
    for (let i = 0; i < tags.length; i++) {
      const at = (q.next + i) % tags.length;
      const c = this.consumers.get(tags[at] as string);
      if (!c || c.down) continue;
      if (!c.autoAck && c.prefetch > 0 && this.unsettled(c) >= c.prefetch) continue;
      q.next = (at + 1) % Math.max(1, tags.length);
      return c;
    }
    return null;
  }

  /** A consumer works through what has reached it, one message at a time. */
  private work(c: Consumer) {
    if (c.down) return;
    for (;;) {
      const d = c.deliveries.find((x) => x.arrivesAt <= this.now);
      if (!d) return;
      if (d.doneAt === null) {
        if (c.paused) return;
        d.doneAt = this.now + c.workMs;
      }
      if (d.doneAt > this.now) return;
      c.deliveries.splice(c.deliveries.indexOf(d), 1);
      c.handled++;
      const ok = !(c.failEvery > 0 && c.handled % c.failEvery === 0);
      this.emit({
        type: 'process',
        at: this.now,
        id: d.message.id,
        consumer: c.tag,
        queue: d.queue,
        ok,
      });
      if (c.autoAck) continue;
      const action = ok ? 'ack' : c.onFail;
      if (action === 'ack') {
        c.stats.acked++;
        this.emit({ type: 'ack', at: this.now, id: d.message.id, consumer: c.tag, queue: d.queue });
      } else {
        if (action === 'requeue') c.stats.nacked++;
        else c.stats.rejected++;
        this.emit({
          type: 'nack',
          at: this.now,
          id: d.message.id,
          consumer: c.tag,
          queue: d.queue,
          requeue: action === 'requeue',
        });
      }
      this.wire.push({
        kind: 'settle',
        arrivesAt: this.now + this.settings.netMs,
        consumer: c.tag,
        delivery: d,
        action,
      });
    }
  }

  /** An ack, nack or reject reaches the broker. */
  private settle(f: Extract<Flight, { kind: 'settle' }>) {
    const q = this.queues.get(f.delivery.queue);
    if (!q) return;
    q.unacked--;
    const m = f.delivery.message;
    if (f.action === 'ack') q.stats.acked++;
    else if (f.action === 'requeue') this.requeue(q, m, 'nack');
    else this.deadLetter(q, m, 'rejected');
  }
}

const ARG_NAMES: Record<keyof QueueArgs, string> = {
  type: 'x-queue-type',
  messageTtl: 'x-message-ttl',
  maxLength: 'x-max-length',
  overflow: 'x-overflow',
  deadLetterExchange: 'x-dead-letter-exchange',
  deadLetterRoutingKey: 'x-dead-letter-routing-key',
  deliveryLimit: 'x-delivery-limit',
  singleActiveConsumer: 'x-single-active-consumer',
};

function newExchange(
  name: string,
  type: ExchangeType,
  o: ExchangeOptions,
  builtin: boolean,
): Exchange {
  return {
    name,
    type,
    durable: o.durable ?? true,
    autoDelete: o.autoDelete ?? false,
    internal: o.internal ?? false,
    alternate: o.alternate ?? null,
    builtin,
    stats: { in: 0, routed: 0, unroutable: 0 },
  };
}

const sameBinding = (a: Binding, b: Binding) =>
  a.source === b.source &&
  a.destination === b.destination &&
  a.destinationType === b.destinationType &&
  a.routingKey === b.routingKey &&
  JSON.stringify(a.args) === JSON.stringify(b.args);

export const bindingName = (b: Binding) =>
  `${b.source || '(default)'} → ${b.destination}${b.routingKey ? ` [${b.routingKey}]` : ''}`;
