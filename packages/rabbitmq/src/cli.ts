// A terminal for the simulated broker: rabbitmqctl and rabbitmqadmin with
// their real subcommands, argument styles and output columns.
import { table, tokenize } from '@shiqi/sim';
import { bindingName, type Broker } from './broker';
import { EXCHANGE_TYPES, type ExchangeType } from './routing';
import { DEFAULT_EXCHANGE, RabbitError, type QueueArgs, type QueueType } from './types';

/** What one command line printed. */
export interface RabbitCliResult {
  lines: string[];
  /** The `clear` command. */
  clear?: boolean;
}

/** Everything the terminal prints on its own (not RabbitMQ's output formats). */
export const RABBIT_CLI_TEXT = {
  help: [
    'rabbitmqctl (inspect and manage the node):',
    '  rabbitmqctl list_queues [name messages messages_ready messages_unacknowledged consumers type arguments]',
    '  rabbitmqctl list_exchanges [name type durable internal]',
    '  rabbitmqctl list_bindings',
    '  rabbitmqctl list_consumers',
    '  rabbitmqctl purge_queue NAME | delete_queue NAME',
    '  rabbitmqctl close_connection CONSUMER_TAG [reason]   (the consumer crashes)',
    '',
    'rabbitmqadmin (the management API from the command line):',
    '  rabbitmqadmin list queues|exchanges|bindings|consumers',
    '  rabbitmqadmin declare exchange name=X type=direct|fanout|topic|headers [internal=true] [arguments=\'{"alternate-exchange":"ae"}\']',
    '  rabbitmqadmin declare queue name=Q [queue_type=quorum] [arguments=\'{"x-message-ttl":5000,"x-dead-letter-exchange":"dlx","x-max-length":3}\']',
    '  rabbitmqadmin declare binding source=X destination=Q [routing_key=K] [destination_type=exchange]',
    '  rabbitmqadmin delete exchange name=X | queue name=Q | binding source=X destination=Q [routing_key=K]',
    '  rabbitmqadmin publish exchange=X routing_key=K payload=TEXT [properties=\'{"headers":{"a":"1"},"expiration":"5000"}\']',
    '  rabbitmqadmin get queue=Q [count=N] [ackmode=ack_requeue_true|ack_requeue_false]',
    '  rabbitmqadmin purge queue name=Q',
    '',
    'clear clears the screen. Up and Down walk the history.',
  ],
  unknown: "{cmd}: command not found. Type 'help' for the commands this terminal knows.",
  usage: 'Error: {detail}',
};

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

class UsageError extends Error {}

type Command = (b: Broker, args: string[]) => RabbitCliResult;

const COMMANDS: Record<string, Command> = {
  rabbitmqctl: ctl,
  rabbitmqadmin: admin,
  help: () => ({ lines: RABBIT_CLI_TEXT.help }),
  clear: () => ({ lines: [], clear: true }),
};

export const RABBIT_CLI_COMMANDS = Object.keys(COMMANDS);

/** Run one command line against the broker. */
export function runRabbitCli(broker: Broker, line: string): RabbitCliResult {
  const [cmd, ...args] = tokenize(line);
  if (!cmd) return { lines: [] };
  const run = COMMANDS[cmd.replace(/\.(sh|bat)$/, '')];
  if (!run) return { lines: [fill(RABBIT_CLI_TEXT.unknown, { cmd })] };
  try {
    return run(broker, args);
  } catch (e) {
    if (e instanceof RabbitError) return { lines: [`Error: ${e.code} - ${e.message}`] };
    if (e instanceof UsageError)
      return { lines: [fill(RABBIT_CLI_TEXT.usage, { detail: e.message })] };
    throw e;
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────

const exchangeLabel = (name: string) => (name === DEFAULT_EXCHANGE ? '' : name);

/** Queue arguments as RabbitMQ prints them: [{"x-message-ttl",5000}, ...]. */
function argList(a: QueueArgs): string {
  const out: [string, string | number | boolean][] = [];
  if (a.type !== 'classic') out.push(['x-queue-type', a.type]);
  if (a.messageTtl !== null) out.push(['x-message-ttl', a.messageTtl]);
  if (a.maxLength !== null) out.push(['x-max-length', a.maxLength]);
  if (a.maxLength !== null && a.overflow !== 'drop-head') out.push(['x-overflow', a.overflow]);
  if (a.deadLetterExchange !== null) out.push(['x-dead-letter-exchange', a.deadLetterExchange]);
  if (a.deadLetterRoutingKey !== null)
    out.push(['x-dead-letter-routing-key', a.deadLetterRoutingKey]);
  if (a.deliveryLimit !== null) out.push(['x-delivery-limit', a.deliveryLimit]);
  if (a.singleActiveConsumer) out.push(['x-single-active-consumer', true]);
  return `[${out.map(([k, v]) => `{"${k}",${typeof v === 'string' ? `"${v}"` : v}}`).join(',')}]`;
}

const QUEUE_COLUMNS: Record<string, (b: Broker, name: string) => string | number> = {
  name: (_, n) => n,
  messages: (b, n) => b.queue(n).ready.length + b.queue(n).unacked,
  messages_ready: (b, n) => b.queue(n).ready.length,
  messages_unacknowledged: (b, n) => b.queue(n).unacked,
  consumers: (b, n) => b.queue(n).consumers.length,
  durable: (b, n) => String(b.queue(n).durable),
  auto_delete: (b, n) => String(b.queue(n).autoDelete),
  type: (b, n) => b.queue(n).args.type,
  arguments: (b, n) => argList(b.queue(n).args),
};

const EXCHANGE_COLUMNS: Record<string, (b: Broker, name: string) => string> = {
  name: (_, n) => exchangeLabel(n),
  type: (b, n) => b.exchange(n).type,
  durable: (b, n) => String(b.exchange(n).durable),
  auto_delete: (b, n) => String(b.exchange(n).autoDelete),
  internal: (b, n) => String(b.exchange(n).internal),
};

function columns<T>(
  all: Record<string, (b: Broker, name: string) => T>,
  wanted: string[],
  fallback: string[],
): string[] {
  const cols = wanted.length ? wanted : fallback;
  for (const c of cols)
    if (!(c in all))
      throw new UsageError(`unknown column '${c}'; use: ${Object.keys(all).join(' ')}`);
  return cols;
}

function listQueues(b: Broker, wanted: string[]): string[] {
  const cols = columns(QUEUE_COLUMNS, wanted, ['name', 'messages']);
  const rows = [...b.queues.keys()].map((n) => cols.map((c) => QUEUE_COLUMNS[c]?.(b, n)));
  return table(cols, rows);
}

function listExchanges(b: Broker, wanted: string[]): string[] {
  const cols = columns(EXCHANGE_COLUMNS, wanted, ['name', 'type']);
  const rows = [...b.exchanges.keys()].map((n) => cols.map((c) => EXCHANGE_COLUMNS[c]?.(b, n)));
  return table(cols, rows);
}

/** Every queue is also bound to the default exchange by its own name. */
function listBindings(b: Broker): string[] {
  const rows: string[][] = [];
  for (const q of b.queues.keys()) rows.push(['', 'exchange', q, 'queue', q, '[]']);
  for (const x of b.bindings)
    rows.push([
      x.source,
      'exchange',
      x.destination,
      x.destinationType,
      x.routingKey,
      `[${Object.entries(x.args)
        .map(([k, v]) => `{"${k}","${v}"}`)
        .join(',')}]`,
    ]);
  return table(
    [
      'source_name',
      'source_kind',
      'destination_name',
      'destination_kind',
      'routing_key',
      'arguments',
    ],
    rows,
  );
}

function listConsumers(b: Broker): string[] {
  return table(
    ['queue_name', 'consumer_tag', 'ack_required', 'prefetch_count', 'active', 'arguments'],
    [...b.consumers.values()]
      .filter((c) => !c.down)
      .map((c) => {
        const q = b.queues.get(c.queue);
        const active = !q?.args.singleActiveConsumer || q.consumers[0] === c.tag;
        return [c.queue, c.tag, String(!c.autoAck), c.prefetch, String(active), '[]'];
      }),
  );
}

// ── rabbitmqctl ────────────────────────────────────────────────────────────

function ctl(b: Broker, args: string[]): RabbitCliResult {
  const [sub, ...rest] = args;
  const flags = rest.filter((a) => !a.startsWith('-'));
  switch (sub) {
    case 'list_queues':
      return {
        lines: [
          'Timeout: 60.0 seconds ...',
          'Listing queues for vhost / ...',
          ...listQueues(b, flags),
        ],
      };
    case 'list_exchanges':
      return { lines: ['Listing exchanges for vhost / ...', ...listExchanges(b, flags)] };
    case 'list_bindings':
      return { lines: ['Listing bindings for vhost /...', ...listBindings(b)] };
    case 'list_consumers':
      return { lines: ['Listing consumers in vhost / ...', ...listConsumers(b)] };
    case 'purge_queue': {
      const name = need(flags[0], 'queue name');
      b.purgeQueue(name);
      return { lines: [`Purging queue '${name}' in vhost '/' ...`] };
    }
    case 'delete_queue': {
      const name = need(flags[0], 'queue name');
      const q = b.queue(name);
      const n = q.ready.length + q.unacked;
      b.deleteQueue(name);
      return {
        lines: [
          `Deleting queue '${name}' on vhost '/' ...`,
          `Queue was successfully deleted with ${n} ready messages`,
        ],
      };
    }
    case 'close_connection': {
      const tag = need(flags[0], 'consumer tag');
      b.crashConsumer(tag);
      return {
        lines: [
          `Closing connection of consumer ${tag}, reason: ${flags[1] ?? 'Closed via rabbitmqctl'}...`,
        ],
      };
    }
    case 'status':
      return {
        lines: [
          'Status of node rabbit@shiqi ...',
          'Runtime',
          'OS PID: 1984',
          'RabbitMQ version: 4.1 (simulated)',
          `Queues: ${b.queues.size}, exchanges: ${b.exchanges.size}, consumers: ${b.consumers.size}`,
        ],
      };
    default:
      return { lines: RABBIT_CLI_TEXT.help.slice(0, 7) };
  }
}

// ── rabbitmqadmin ──────────────────────────────────────────────────────────

/** key=value arguments, as rabbitmqadmin takes them. */
function kv(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of args) {
    const i = a.indexOf('=');
    if (i <= 0) throw new UsageError(`expected key=value, got '${a}'`);
    out[a.slice(0, i)] = a.slice(i + 1);
  }
  return out;
}

const need = (v: string | undefined, what: string) => {
  if (v === undefined) throw new UsageError(`missing ${what}`);
  return v;
};

function json(raw: string | undefined, what: string): Record<string, unknown> {
  if (raw === undefined || raw === '') return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new UsageError(`${what} must be a JSON object`);
}

const bool = (raw: string | undefined, fallback: boolean) =>
  raw === undefined ? fallback : raw === 'true' || raw === 'True';

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new UsageError(`'${String(v)}' is not a number`);
  return n;
};

const str = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));

function queueArgs(
  raw: Record<string, unknown>,
  queueType: string | undefined,
): Partial<QueueArgs> {
  const known = new Set([
    'x-queue-type',
    'x-message-ttl',
    'x-max-length',
    'x-overflow',
    'x-dead-letter-exchange',
    'x-dead-letter-routing-key',
    'x-delivery-limit',
    'x-single-active-consumer',
  ]);
  for (const k of Object.keys(raw))
    if (!known.has(k)) throw new UsageError(`this simulator doesn't know queue argument '${k}'`);
  const out: Partial<QueueArgs> = {};
  const type = queueType ?? str(raw['x-queue-type']);
  if (type !== null) {
    if (type !== 'classic' && type !== 'quorum')
      throw new UsageError(`queue type '${type}': use classic or quorum`);
    out.type = type as QueueType;
  }
  if ('x-message-ttl' in raw) out.messageTtl = num(raw['x-message-ttl']);
  if ('x-max-length' in raw) out.maxLength = num(raw['x-max-length']);
  if ('x-overflow' in raw) {
    const o = String(raw['x-overflow']);
    if (o !== 'drop-head' && o !== 'reject-publish')
      throw new UsageError(`x-overflow '${o}': use drop-head or reject-publish`);
    out.overflow = o;
  }
  if ('x-dead-letter-exchange' in raw) out.deadLetterExchange = str(raw['x-dead-letter-exchange']);
  if ('x-dead-letter-routing-key' in raw)
    out.deadLetterRoutingKey = str(raw['x-dead-letter-routing-key']);
  if ('x-delivery-limit' in raw) out.deliveryLimit = num(raw['x-delivery-limit']);
  if ('x-single-active-consumer' in raw)
    out.singleActiveConsumer =
      raw['x-single-active-consumer'] === true || raw['x-single-active-consumer'] === 'true';
  return out;
}

function admin(b: Broker, args: string[]): RabbitCliResult {
  const [verb, noun, ...rest] = args;
  switch (verb) {
    case 'list':
      switch (noun) {
        case 'queues':
          return {
            lines: listQueues(b, [
              'name',
              'messages',
              'messages_ready',
              'messages_unacknowledged',
              'consumers',
            ]),
          };
        case 'exchanges':
          return { lines: listExchanges(b, ['name', 'type']) };
        case 'bindings':
          return { lines: listBindings(b) };
        case 'consumers':
          return { lines: listConsumers(b) };
        default:
          throw new UsageError('list what? queues, exchanges, bindings or consumers');
      }
    case 'declare': {
      const a = kv(rest);
      switch (noun) {
        case 'exchange': {
          const type = need(a.type, 'type=') as ExchangeType;
          if (!EXCHANGE_TYPES.includes(type))
            throw new UsageError(`type must be one of ${EXCHANGE_TYPES.join(', ')}`);
          const extra = json(a.arguments, 'arguments');
          b.declareExchange(need(a.name, 'name='), type, {
            durable: bool(a.durable, true),
            autoDelete: bool(a.auto_delete, false),
            internal: bool(a.internal, false),
            alternate: str(extra['alternate-exchange']),
          });
          return { lines: ['exchange declared'] };
        }
        case 'queue': {
          b.declareQueue(need(a.name, 'name='), {
            durable: bool(a.durable, true),
            autoDelete: bool(a.auto_delete, false),
            args: queueArgs(json(a.arguments, 'arguments'), a.queue_type),
          });
          return { lines: ['queue declared'] };
        }
        case 'binding': {
          b.bind({
            source: need(a.source, 'source='),
            destination: need(a.destination, 'destination='),
            destinationType: a.destination_type === 'exchange' ? 'exchange' : 'queue',
            routingKey: a.routing_key ?? '',
            args: Object.fromEntries(
              Object.entries(json(a.arguments, 'arguments')).map(([k, v]) => [k, String(v)]),
            ),
          });
          return { lines: ['binding declared'] };
        }
        default:
          throw new UsageError('declare what? exchange, queue or binding');
      }
    }
    case 'delete': {
      const a = kv(rest);
      switch (noun) {
        case 'exchange':
          b.deleteExchange(need(a.name, 'name='));
          return { lines: ['exchange deleted'] };
        case 'queue':
          b.deleteQueue(need(a.name, 'name='));
          return { lines: ['queue deleted'] };
        case 'binding': {
          const binding = {
            source: need(a.source, 'source='),
            destination: need(a.destination, 'destination='),
            destinationType:
              a.destination_type === 'exchange' ? ('exchange' as const) : ('queue' as const),
            routingKey: a.routing_key ?? a.properties_key ?? '',
          };
          b.unbind(binding);
          return { lines: [`binding deleted: ${bindingName({ ...binding, args: {} })}`] };
        }
        default:
          throw new UsageError('delete what? exchange, queue or binding');
      }
    }
    case 'publish': {
      const a = kv(noun === undefined ? [] : [noun, ...rest]);
      const exchange = a.exchange ?? '';
      const key = need(a.routing_key, 'routing_key=');
      const props = json(a.properties, 'properties');
      const headers = Object.fromEntries(
        Object.entries((props.headers ?? {}) as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v),
        ]),
      );
      const routed = b.route(exchange, key, headers).queues.length > 0;
      b.publish({
        exchange,
        routingKey: key,
        body: a.payload ?? '',
        headers,
        expiration: num(props.expiration),
        persistent: props.delivery_mode !== 1,
      });
      return { lines: [routed ? 'Message published' : 'Message published but NOT routed'] };
    }
    case 'get': {
      const a = kv(noun === undefined ? [] : [noun, ...rest]);
      const queue = need(a.queue, 'queue=');
      const count = num(a.count) ?? 1;
      const mode = a.ackmode ?? 'ack_requeue_true';
      if (mode !== 'ack_requeue_true' && mode !== 'ack_requeue_false')
        throw new UsageError('ackmode must be ack_requeue_true or ack_requeue_false');
      const requeue = mode === 'ack_requeue_true';
      const got = b.getMessages(queue, count, requeue);
      if (!got.length) return { lines: ['No items'] };
      const left = b.queue(queue).ready.length;
      return {
        lines: table(
          ['routing_key', 'exchange', 'message_count', 'payload', 'redelivered'],
          got.map((m, i) => [
            m.routingKey,
            exchangeLabel(m.exchange),
            requeue ? left - (i + 1) : left + (got.length - (i + 1)),
            m.body,
            String(m.redelivered),
          ]),
        ),
      };
    }
    case 'purge': {
      if (noun !== 'queue') throw new UsageError('purge queue name=Q');
      const a = kv(rest);
      b.purgeQueue(need(a.name, 'name='));
      return { lines: ['queue purged'] };
    }
    default:
      return { lines: RABBIT_CLI_TEXT.help.slice(8, 17) };
  }
}
