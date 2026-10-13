// Shapes of the simulated broker. Names follow RabbitMQ's own vocabulary
// (exchange, binding, delivery tag, prefetch, x-dead-letter-exchange...) so
// the docs, the CLI and the pictures read the same.
import type { ExchangeType } from './routing';

/** The default exchange: nameless, direct, bound to every queue by its name. */
export const DEFAULT_EXCHANGE = '';

export interface Exchange {
  name: string;
  type: ExchangeType;
  durable: boolean;
  /** Deleted when its last binding goes. */
  autoDelete: boolean;
  /** Publishers can't use it; only other exchanges and dead-lettering can. */
  internal: boolean;
  /** alternate-exchange: where messages go that match no binding. */
  alternate: string | null;
  /** Declared by the broker itself (the default exchange and amq.*). */
  builtin: boolean;
  stats: { in: number; routed: number; unroutable: number };
}

export interface Binding {
  /** The exchange messages come from. */
  source: string;
  /** The queue (or exchange) they go to. */
  destination: string;
  destinationType: 'queue' | 'exchange';
  /** Binding key: a word for direct, a pattern for topic, ignored by fanout and headers. */
  routingKey: string;
  /** Binding arguments; a headers exchange matches on them. */
  args: Record<string, string>;
}

/** Why a message left a queue without being acked. */
export type DeathReason = 'rejected' | 'expired' | 'maxlen' | 'delivery_limit';

/** One entry of the x-death header. */
export interface Death {
  queue: string;
  reason: DeathReason;
  exchange: string;
  routingKey: string;
  count: number;
  time: number;
}

export interface Message {
  /** Unique within a broker; stays the same when the message is requeued or dead-lettered. */
  id: number;
  body: string;
  /** The exchange and routing key it was last published with. */
  exchange: string;
  routingKey: string;
  headers: Record<string, string>;
  /** delivery_mode 2: written to disk on durable queues. */
  persistent: boolean;
  /** Per-message TTL (the expiration property), in ms. */
  expiration: number | null;
  publisher: string | null;
  publishedAt: number;
  /** When it entered the queue it is in now; TTL counts from here. */
  enqueuedAt: number;
  /** Set once a delivery of it was not acked (requeued after a nack or a crash). */
  redelivered: boolean;
  /** How many times it was delivered from this queue. */
  deliveries: number;
  deaths: Death[];
}

export type Overflow = 'drop-head' | 'reject-publish';
export type QueueType = 'classic' | 'quorum';

/** Queue arguments, under their x- names in the CLI. */
export interface QueueArgs {
  /** x-queue-type */
  type: QueueType;
  /** x-message-ttl: ms a message may wait in the queue. */
  messageTtl: number | null;
  /** x-max-length: most ready messages the queue holds. */
  maxLength: number | null;
  /** x-overflow: what happens to a message that doesn't fit. */
  overflow: Overflow;
  /** x-dead-letter-exchange */
  deadLetterExchange: string | null;
  /** x-dead-letter-routing-key: replaces the routing key when dead-lettering. */
  deadLetterRoutingKey: string | null;
  /** x-delivery-limit (quorum queues): deliveries before a message is dead-lettered. */
  deliveryLimit: number | null;
  /** x-single-active-consumer: only one consumer gets messages; the rest wait. */
  singleActiveConsumer: boolean;
}

export const QUEUE_DEFAULTS: QueueArgs = {
  type: 'classic',
  messageTtl: null,
  maxLength: null,
  overflow: 'drop-head',
  deadLetterExchange: null,
  deadLetterRoutingKey: null,
  deliveryLimit: null,
  singleActiveConsumer: false,
};

export interface Queue {
  name: string;
  durable: boolean;
  /** Deleted when its last consumer goes. */
  autoDelete: boolean;
  args: QueueArgs;
  /** Messages waiting to be delivered, head first. */
  ready: Message[];
  /** Delivered, not yet acked. */
  unacked: number;
  /** Consumer tags, in the order they subscribed. */
  consumers: string[];
  /** Round-robin position in `consumers`. */
  next: number;
  stats: {
    enqueued: number;
    delivered: number;
    acked: number;
    redelivered: number;
    deadLettered: number;
    dropped: number;
  };
}

/** A message on its way to a consumer, or in the consumer's hands. */
export interface Delivery {
  tag: number;
  message: Message;
  queue: string;
  /** When it reaches the consumer. */
  arrivesAt: number;
  /** When the consumer finishes working on it; null while it waits its turn. */
  doneAt: number | null;
}

/** What a consumer does when it can't process a message. */
export type FailAction = 'requeue' | 'reject';

export interface Consumer {
  tag: string;
  queue: string;
  /** basic.qos prefetch_count: most unacked deliveries at once; 0 = no limit. */
  prefetch: number;
  /** no_ack: the broker forgets a message as soon as it sends it. */
  autoAck: boolean;
  /** Time to process one message. */
  workMs: number;
  /** Every Nth message fails (0 = never)... */
  failEvery: number;
  /** ...and is nacked back to the queue, or rejected (dead-lettered or dropped). */
  onFail: FailAction;
  paused: boolean;
  /** The connection is gone (crashed); restart to subscribe again. */
  down: boolean;
  /** Deliveries sent to it and not settled: on the wire, buffered or being worked on. */
  deliveries: Delivery[];
  /** Messages handled so far, to pick which ones fail. */
  handled: number;
  stats: { received: number; acked: number; nacked: number; rejected: number; lost: number };
}

export interface Publisher {
  id: string;
  exchange: string;
  /** Routing keys used in turn. */
  keys: string[];
  /** Headers used in turn (for headers exchanges); empty for none. */
  headers: Record<string, string>[];
  /** Messages per second. */
  rate: number;
  /** Publisher confirms: the broker acks each message once it is safely in every queue. */
  confirm: boolean;
  /** mandatory flag: an unroutable message comes back (basic.return) instead of vanishing. */
  mandatory: boolean;
  persistent: boolean;
  /** Per-message TTL to set, if any. */
  expiration: number | null;
  paused: boolean;
  stats: { sent: number; confirmed: number; nacked: number; returned: number };
}

export interface BrokerSettings {
  /** Length of one simulation step. */
  tickMs: number;
  /** One-way network delay between a client and the broker. */
  netMs: number;
}

export const BROKER_DEFAULTS: BrokerSettings = {
  tickMs: 50,
  netMs: 300,
};

/** Error codes as AMQP names them (the reply text of channel.close). */
export type RabbitErrorCode =
  'NOT_FOUND' | 'PRECONDITION_FAILED' | 'ACCESS_REFUSED' | 'RESOURCE_LOCKED' | 'COMMAND_INVALID';

export class RabbitError extends Error {
  constructor(
    readonly code: RabbitErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RabbitError';
  }
}

/** Everything that happens, as it happens. */
export type BrokerEvent =
  | {
      type: 'publish';
      at: number;
      id: number;
      publisher: string | null;
      exchange: string;
      key: string;
    }
  | {
      type: 'route';
      at: number;
      id: number;
      exchange: string;
      key: string;
      /** Queues it was put in. */
      queues: string[];
      /** Exchanges it went through on the way (exchange-to-exchange bindings, alternate exchange). */
      via: string[];
    }
  | {
      type: 'unroutable';
      at: number;
      id: number;
      exchange: string;
      key: string;
      publisher: string | null;
      /** returned: mandatory, sent back to the publisher. dropped: gone without a word. */
      outcome: 'returned' | 'dropped';
    }
  | { type: 'confirm'; at: number; id: number; publisher: string; ok: boolean }
  | {
      type: 'deliver';
      at: number;
      id: number;
      tag: number;
      queue: string;
      consumer: string;
      redelivered: boolean;
    }
  | { type: 'process'; at: number; id: number; consumer: string; queue: string; ok: boolean }
  | { type: 'ack'; at: number; id: number; consumer: string; queue: string }
  | {
      type: 'nack';
      at: number;
      id: number;
      consumer: string;
      queue: string;
      requeue: boolean;
    }
  | {
      type: 'requeue';
      at: number;
      id: number;
      queue: string;
      reason: 'nack' | 'crash' | 'get' | 'cancel';
    }
  | {
      type: 'dead-letter';
      at: number;
      id: number;
      queue: string;
      exchange: string;
      key: string;
      reason: DeathReason;
    }
  | { type: 'drop'; at: number; id: number; queue: string; reason: DeathReason }
  | {
      type: 'reject-publish';
      at: number;
      id: number;
      queue: string;
      publisher: string | null;
    }
  | {
      type: 'consumer-down';
      at: number;
      consumer: string;
      queue: string;
      requeued: number;
      lost: number;
    }
  | { type: 'consumer-up'; at: number; consumer: string; queue: string }
  | { type: 'consumer-cancel'; at: number; consumer: string; queue: string }
  | { type: 'active-consumer'; at: number; consumer: string; queue: string }
  | { type: 'get'; at: number; id: number; queue: string; requeue: boolean }
  | { type: 'purge'; at: number; queue: string; count: number }
  | {
      type: 'declare';
      at: number;
      kind: 'exchange' | 'queue' | 'binding';
      name: string;
    }
  | {
      type: 'delete';
      at: number;
      kind: 'exchange' | 'queue' | 'binding';
      name: string;
    };

export type BrokerEventType = BrokerEvent['type'];
