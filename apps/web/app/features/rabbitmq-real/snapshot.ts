// The real broker at a glance, as /api/rabbitmq/snapshot sends it: what the
// management API reports, cut down to what the page shows. Pure, so the
// server builds it and tests check it without a broker.
import { queueArgsFrom, type QueueArgs } from '@shiqi/rabbitmq';

export interface RabbitQueue {
  name: string;
  /** classic, quorum or stream, as the broker says. */
  type: string;
  args: QueueArgs;
  state: string;
  ready: number;
  unacked: number;
  consumers: number;
  /** Messages per second, averaged by the broker over its last few seconds. */
  rates: { publish: number; deliver: number; ack: number; redeliver: number };
}

export interface RabbitExchange {
  name: string;
  type: string;
  rates: { in: number; out: number };
}

export interface RabbitBinding {
  source: string;
  destination: string;
  destinationType: string;
  routingKey: string;
}

export interface RabbitSnapshot {
  /** When the server read it (ms since the epoch). */
  at: number;
  version: string;
  node: {
    name: string;
    uptimeMs: number;
    memUsed: number;
    memLimit: number;
    /** A memory or disk alarm: publishers are blocked until it clears. */
    alarm: boolean;
  };
  connections: number;
  queues: RabbitQueue[];
  exchanges: RabbitExchange[];
  bindings: RabbitBinding[];
}

/** The management API's JSON, typed only as far as it is read. */
type Raw = Record<string, unknown>;

/** What toSnapshot reads: GET /api/overview, /api/nodes, /api/queues, /api/exchanges, /api/bindings. */
export interface RawManagement {
  overview: Raw;
  nodes: Raw[];
  queues: Raw[];
  exchanges: Raw[];
  bindings: Raw[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Raw => (typeof v === 'object' && v !== null ? (v as Raw) : {});
/** message_stats.<name>_details.rate, 0 when the broker hasn't seen any yet. */
const rate = (stats: unknown, name: string) => num(obj(obj(stats)[`${name}_details`]).rate);

/** Exchanges the broker makes for itself, hidden like the simulation hides them. */
export const isBuiltinExchange = (name: string) => name === '' || name.startsWith('amq.');

export function toSnapshot(raw: RawManagement, at: number): RabbitSnapshot {
  const node = raw.nodes[0] ?? {};
  return {
    at,
    version: str(raw.overview.rabbitmq_version),
    node: {
      name: str(node.name),
      uptimeMs: num(node.uptime),
      memUsed: num(node.mem_used),
      memLimit: num(node.mem_limit),
      alarm: node.mem_alarm === true || node.disk_free_alarm === true,
    },
    connections: num(obj(raw.overview.object_totals).connections),
    queues: raw.queues
      .map((q) => ({
        name: str(q.name),
        type: str(q.type) || 'classic',
        args: queueArgsFrom(obj(q.arguments), str(q.type) || undefined),
        state: str(q.state),
        ready: num(q.messages_ready),
        unacked: num(q.messages_unacknowledged),
        consumers: num(q.consumers),
        rates: {
          publish: rate(q.message_stats, 'publish'),
          deliver: rate(q.message_stats, 'deliver_get'),
          ack: rate(q.message_stats, 'ack'),
          redeliver: rate(q.message_stats, 'redeliver'),
        },
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    exchanges: raw.exchanges
      .filter((x) => !isBuiltinExchange(str(x.name)))
      .map((x) => ({
        name: str(x.name),
        type: str(x.type),
        rates: {
          in: rate(x.message_stats, 'publish_in'),
          out: rate(x.message_stats, 'publish_out'),
        },
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    // The default exchange's implicit binding to every queue says nothing new.
    bindings: raw.bindings
      .filter((b) => str(b.source) !== '')
      .map((b) => ({
        source: str(b.source),
        destination: str(b.destination),
        destinationType: str(b.destination_type),
        routingKey: str(b.routing_key),
      })),
  };
}
