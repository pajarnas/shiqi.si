// A terminal for the simulated cluster: the stock Kafka scripts (kafka-topics,
// kafka-console-producer, ...) with their real flags and output formats, plus
// a few `broker ...` commands that only make sense in a simulator.
import type { Cluster, Member, Partition } from './cluster';
import {
  TOPIC_DEFAULTS,
  isTopicConfigKey,
  parseTopicConfig,
  parseTopicConfigs,
  type TopicConfigKey,
} from './config';
import { murmur2, toPositive } from './murmur2';
import { KafkaError, type Acks, type KRecord, type KafkaErrorCode } from './types';

/** An interactive program (console producer or consumer) that owns the terminal until closed. */
export interface CliSession {
  /** Shown before each input line, e.g. '>' for the producer; '' when input is not expected. */
  prompt: string;
  /** A line the user typed while the session runs. */
  input(line: string): string[];
  /** New output since the last call (records a consumer received). */
  poll(): string[];
  /** Ctrl-C / Ctrl-D. Returns the goodbye lines. */
  close(): string[];
  readonly done: boolean;
}

export interface CliResult {
  lines: string[];
  session?: CliSession;
  /** The `clear` command. */
  clear?: boolean;
}

/** Everything the terminal prints on its own (not Kafka's output formats). */
export const CLI_TEXT = {
  help: [
    'Kafka scripts (as in bin/ of a Kafka download; ".sh" is optional):',
    '  kafka-topics --create --topic T --partitions N --replication-factor R [--config k=v]',
    '  kafka-topics --list | --describe [--topic T] | --delete --topic T',
    '  kafka-topics --alter --topic T --partitions N',
    '  kafka-configs --entity-type topics --entity-name T --describe | --alter --add-config k=v[,k=v]',
    '  kafka-console-producer --topic T [--property parse.key=true --property key.separator=:]',
    '  kafka-console-producer --topic T [--producer-property acks=all|1|0]',
    '  kafka-console-consumer --topic T [--group G] [--from-beginning] [--max-messages N]',
    '                         [--property print.key=true|print.partition=true|print.offset=true]',
    '  kafka-consumer-groups --list | --describe --group G [--members | --state]',
    '  kafka-consumer-groups --reset-offsets --group G --topic T[:P,P] --to-earliest|--to-latest',
    '                        |--to-offset N|--shift-by N --execute|--dry-run',
    '  kafka-consumer-groups --delete --group G',
    '  kafka-leader-election --election-type PREFERRED --all-topic-partitions | --topic T --partition P',
    '  kafka-metadata-quorum describe --status',
    '  kafka-producer-perf-test --topic T --num-records N --record-size B [--producer-props acks=1]',
    'Simulator only:',
    '  broker list | broker stop ID | broker start ID | broker slow ID | broker fast ID | broker add',
    '  clear | help',
    'In the console producer and consumer, type exit (or press Ctrl-C) to stop.',
  ],
  unknown: '{cmd}: command not found. Type help for the list.',
  missing: 'Missing required argument "[{arg}]"',
  brokerStopped: 'Broker {id} stopped.',
  brokerStarted: 'Broker {id} started.',
  brokerSlow: 'Broker {id} is now slow: its follower fetches lag behind.',
  brokerFast: 'Broker {id} is back to normal speed.',
  brokerAdded:
    'Broker {id} joined the cluster. It has no partitions until some are created or reassigned.',
  brokerUsage: 'Usage: broker list | stop ID | start ID | slow ID | fast ID | add',
  exitHint: 'exit',
} as const;

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** Java exception class for each error code, as the scripts print them. */
const EXCEPTIONS: Record<KafkaErrorCode, string> = {
  UNKNOWN_TOPIC_OR_PARTITION: 'UnknownTopicOrPartitionException',
  LEADER_NOT_AVAILABLE: 'LeaderNotAvailableException',
  NOT_ENOUGH_REPLICAS: 'NotEnoughReplicasException',
  REQUEST_TIMED_OUT: 'TimeoutException',
  NOT_LEADER_OR_FOLLOWER: 'NotLeaderOrFollowerException',
  INVALID_RECORD: 'InvalidRecordException',
  TOPIC_ALREADY_EXISTS: 'TopicExistsException',
  INVALID_REPLICATION_FACTOR: 'InvalidReplicationFactorException',
  INVALID_PARTITIONS: 'InvalidPartitionsException',
  INVALID_CONFIG: 'InvalidConfigurationException',
  GROUP_ID_NOT_FOUND: 'GroupIdNotFoundException',
  NON_EMPTY_GROUP: 'GroupNotEmptyException',
  BROKER_NOT_AVAILABLE: 'BrokerNotAvailableException',
};

export const exceptionName = (code: KafkaErrorCode) =>
  `org.apache.kafka.common.errors.${EXCEPTIONS[code]}`;

// ── Parsing ────────────────────────────────────────────────────────────────

/** Split a command line like a shell: spaces separate, quotes group. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let has = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur);
      cur = '';
      has = false;
    } else {
      cur += ch;
    }
  }
  if (has || cur) out.push(cur);
  return out;
}

interface Args {
  positional: string[];
  flags: Map<string, string[]>;
}

/** `--name value` pairs (repeatable) and bare `--switch`es. */
function parseArgs(tokens: string[], switches: readonly string[]): Args {
  const flags = new Map<string, string[]>();
  const positional: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] as string;
    if (!tok.startsWith('--')) {
      positional.push(tok);
      continue;
    }
    const [name, inline] = tok.slice(2).split(/=(.*)/s) as [string, string | undefined];
    const list = flags.get(name) ?? [];
    if (inline !== undefined) list.push(inline);
    else if (
      !switches.includes(name) &&
      i + 1 < tokens.length &&
      !tokens[i + 1]?.startsWith('--')
    ) {
      list.push(tokens[++i] as string);
    }
    flags.set(name, list);
  }
  return { positional, flags };
}

const has = (a: Args, name: string) => a.flags.has(name);
const one = (a: Args, name: string) => a.flags.get(name)?.at(-1);
const need = (a: Args, name: string) => {
  const v = one(a, name);
  if (v === undefined) throw new UsageError(fill(CLI_TEXT.missing, { arg: name }));
  return v;
};
const int = (a: Args, name: string) => {
  const v = one(a, name);
  if (v === undefined) return undefined;
  if (!/^-?\d+$/.test(v)) throw new UsageError(`Invalid value ${v} for option ${name}`);
  return Number(v);
};

/** `k=v` pairs from repeated flags and comma-separated lists. */
function pairs(values: string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of values ?? []) {
    for (const part of v.split(',')) {
      const [k, val] = part.split(/=(.*)/s);
      if (k) out[k.trim()] = (val ?? '').trim();
    }
  }
  return out;
}

class UsageError extends Error {}

/** Columns padded to the widest cell, like the AdminClient tools print. */
export function table(headers: string[], rows: (string | number | undefined)[][]): string[] {
  const cells = [headers, ...rows.map((r) => r.map((c) => (c === undefined ? '-' : String(c))))];
  const widths = headers.map((_, i) => Math.max(...cells.map((r) => (r[i] ?? '').length)));
  return cells.map((r) =>
    r
      .map((c, i) => (c ?? '').padEnd(widths[i] ?? 0))
      .join(' ')
      .trimEnd(),
  );
}

// ── Commands ───────────────────────────────────────────────────────────────

type Command = (c: Cluster, args: string[]) => CliResult;

const COMMANDS: Record<string, Command> = {
  'kafka-topics': topics,
  'kafka-configs': configs,
  'kafka-console-producer': consoleProducer,
  'kafka-console-consumer': consoleConsumer,
  'kafka-consumer-groups': consumerGroups,
  'kafka-leader-election': leaderElection,
  'kafka-metadata-quorum': metadataQuorum,
  'kafka-producer-perf-test': perfTest,
  broker,
  help: () => ({ lines: [...CLI_TEXT.help] }),
  clear: () => ({ lines: [], clear: true }),
};

/** Names the terminal can complete. */
export const CLI_COMMANDS = Object.keys(COMMANDS);

/** Run one command line against the cluster. Never throws: errors become output. */
export function runCli(cluster: Cluster, line: string): CliResult {
  const tokens = tokenize(line.trim());
  const first = tokens[0];
  if (!first) return { lines: [] };
  const name = first.replace(/^(\.\/)?(bin\/)?/, '').replace(/\.sh$/, '');
  const cmd = COMMANDS[name];
  if (!cmd) return { lines: [fill(CLI_TEXT.unknown, { cmd: first })] };
  try {
    return cmd(cluster, tokens.slice(1));
  } catch (e) {
    if (e instanceof UsageError) return { lines: [e.message] };
    if (e instanceof KafkaError) {
      const tool = name.replace(/^kafka-/, '').replace(/s$/, '');
      return {
        lines: [
          `Error while executing ${tool} command : ${e.message}`,
          `${exceptionName(e.code)}: ${e.message}`,
        ],
      };
    }
    throw e;
  }
}

function describePartition(p: Partition): string {
  return [
    `\tTopic: ${p.topic}`,
    `Partition: ${p.id}`,
    `Leader: ${p.leader ?? 'none'}`,
    `Replicas: ${p.replicas.join(',')}`,
    `Isr: ${p.isr.join(',')}`,
    'Elr: ',
    'LastKnownElr: ',
  ].join('\t');
}

function dynamicConfigs(c: Cluster, topic: string): [TopicConfigKey, string][] {
  const t = c.topic(topic);
  return (Object.keys(t.config) as TopicConfigKey[])
    .filter((k) => t.config[k] !== TOPIC_DEFAULTS[k])
    .map((k) => [k, String(t.config[k])]);
}

function topics(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, [
    'create',
    'list',
    'describe',
    'delete',
    'alter',
    'if-not-exists',
    'under-replicated-partitions',
    'unavailable-partitions',
    'exclude-internal',
  ]);
  if (has(a, 'create')) {
    const name = need(a, 'topic');
    if (has(a, 'if-not-exists') && c.topics.has(name)) return { lines: [] };
    c.createTopic(name, {
      partitions: int(a, 'partitions') ?? 1,
      replicationFactor: int(a, 'replication-factor') ?? Math.min(3, c.liveBrokers.length),
      config: parseTopicConfigs(pairs(a.flags.get('config'))),
    });
    return { lines: [`Created topic ${name}.`] };
  }
  if (has(a, 'list')) return { lines: [...c.topics.keys()].sort() };
  if (has(a, 'delete')) {
    c.deleteTopic(need(a, 'topic'));
    return { lines: [] };
  }
  if (has(a, 'alter')) {
    const name = need(a, 'topic');
    const n = int(a, 'partitions');
    if (n === undefined) throw new UsageError(fill(CLI_TEXT.missing, { arg: 'partitions' }));
    c.addPartitions(name, n);
    return { lines: [] };
  }
  if (has(a, 'describe')) {
    const only = one(a, 'topic');
    const names = only ? [c.topic(only).name] : [...c.topics.keys()].sort();
    const under = has(a, 'under-replicated-partitions');
    const unavailable = has(a, 'unavailable-partitions');
    const lines: string[] = [];
    for (const n of names) {
      const t = c.topic(n);
      if (under || unavailable) {
        for (const p of t.partitions) {
          if ((under && p.isr.length < p.replicas.length) || (unavailable && p.leader === null)) {
            lines.push(describePartition(p));
          }
        }
        continue;
      }
      const cfg = dynamicConfigs(c, n)
        .map(([k, v]) => `${k}=${v}`)
        .join(',');
      lines.push(
        `Topic: ${n}\tTopicId: ${t.id}\tPartitionCount: ${t.partitions.length}\tReplicationFactor: ${t.partitions[0]?.replicas.length ?? 0}\tConfigs: ${cfg}`,
      );
      for (const p of t.partitions) lines.push(describePartition(p));
    }
    return { lines };
  }
  throw new UsageError(
    'Command must include exactly one action: --list, --describe, --create, --alter or --delete',
  );
}

function configs(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, ['describe', 'alter']);
  const type = one(a, 'entity-type') ?? (one(a, 'topic') ? 'topics' : undefined);
  const name = one(a, 'entity-name') ?? one(a, 'topic');
  if (type !== 'topics') {
    throw new UsageError('This simulator supports --entity-type topics (or --topic T).');
  }
  if (!name) throw new UsageError(fill(CLI_TEXT.missing, { arg: 'entity-name' }));
  if (has(a, 'alter')) {
    const add = pairs(a.flags.get('add-config'));
    const remove = (a.flags.get('delete-config') ?? []).flatMap((v) => v.split(','));
    c.topic(name);
    for (const [k, v] of Object.entries(add))
      c.setTopicConfig(name, k as TopicConfigKey, parseTopicConfig(k, v));
    for (const k of remove) {
      if (!isTopicConfigKey(k))
        throw new KafkaError('INVALID_CONFIG', `Unknown topic config name: ${k}`);
      c.setTopicConfig(name, k, TOPIC_DEFAULTS[k]);
    }
    return { lines: [`Completed updating config for topic ${name}.`] };
  }
  const lines = [`Dynamic configs for topic ${name} are:`];
  for (const [k, v] of dynamicConfigs(c, name)) {
    lines.push(`  ${k}=${v} sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:${k}=${v}}`);
  }
  return { lines };
}

const parseAcks = (raw: string | undefined): Acks => (raw === '0' ? 0 : raw === '1' ? 1 : 'all');

function sendError(topic: string, e: unknown): string[] {
  if (!(e instanceof KafkaError)) throw e;
  return [
    `ERROR Error when sending message to topic ${topic}: ${exceptionName(e.code)}: ${e.message}`,
  ];
}

function consoleProducer(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, []);
  const topic = need(a, 'topic');
  c.topic(topic);
  const props = pairs(a.flags.get('property'));
  const producerProps = pairs(a.flags.get('producer-property'));
  const parseKey = props['parse.key'] === 'true';
  const sep = props['key.separator'] ?? '\t';
  const acks = parseAcks(producerProps.acks ?? one(a, 'request-required-acks'));
  let done = false;
  const session: CliSession = {
    prompt: '>',
    get done() {
      return done;
    },
    input(line) {
      if (line.trim() === CLI_TEXT.exitHint) return session.close();
      let key: string | null = null;
      let value = line;
      if (parseKey) {
        const i = line.indexOf(sep);
        if (i < 0) {
          return [
            `org.apache.kafka.common.KafkaException: No key separator found on line number 1: '${line}'`,
          ];
        }
        key = line.slice(0, i);
        value = line.slice(i + sep.length);
      }
      try {
        c.produce({ topic, key, value, acks, producer: 'console-producer' });
        return [];
      } catch (e) {
        return sendError(topic, e);
      }
    },
    poll: () => [],
    close() {
      done = true;
      return [];
    },
  };
  return { lines: [], session };
}

function formatRecord(r: KRecord, partition: number, props: Record<string, string>): string {
  const on = (k: string) => props[k] === 'true';
  const parts: string[] = [];
  if (on('print.timestamp')) parts.push(`CreateTime:${r.timestamp}`);
  if (on('print.partition')) parts.push(`Partition:${partition}`);
  if (on('print.offset')) parts.push(`Offset:${r.offset}`);
  if (on('print.key')) parts.push(r.key ?? 'null');
  parts.push(r.value ?? 'null');
  return parts.join(props['key.separator'] ?? '\t');
}

function consoleConsumer(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, ['from-beginning', 'skip-message-on-error']);
  const topic = need(a, 'topic');
  c.topic(topic);
  const props = pairs(a.flags.get('property'));
  const max = int(a, 'max-messages');
  const anonymous = !one(a, 'group');
  const group =
    one(a, 'group') ?? `console-consumer-${toPositive(murmur2(`${c.now}-${topic}`)) % 100000}`;
  const member: Member = c.addConsumer({
    group,
    topics: [topic],
    clientId: 'console-consumer',
    offsetReset: has(a, 'from-beginning') ? 'earliest' : 'latest',
    rate: 200,
  });
  let buffer: string[] = [];
  let count = 0;
  let done = false;
  const stop = c.onEvent((e) => {
    if (done || e.type !== 'consume' || e.member !== member.id) return;
    const p = c.topics.get(e.topic)?.partitions[e.partition];
    const log = p && c.leaderLog(p);
    if (!log) return;
    for (const r of log.read(e.fromOffset, Infinity, e.count)) {
      if (max !== undefined && count >= max) break;
      buffer.push(formatRecord(r, e.partition, props));
      count++;
    }
  });
  const close = () => {
    if (done) return [];
    done = true;
    stop();
    c.removeConsumer(group, member.id);
    if (anonymous) c.deleteGroup(group);
    return [`Processed a total of ${count} messages`];
  };
  const session: CliSession = {
    prompt: '',
    get done() {
      return done;
    },
    input: (line) => (line.trim() === CLI_TEXT.exitHint ? close() : []),
    poll() {
      const out = buffer;
      buffer = [];
      if (max !== undefined && count >= max) out.push(...close());
      return out;
    },
    close,
  };
  return { lines: [], session };
}

function consumerGroups(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, [
    'list',
    'describe',
    'delete',
    'reset-offsets',
    'members',
    'state',
    'offsets',
    'execute',
    'dry-run',
    'to-earliest',
    'to-latest',
    'all-topics',
  ]);
  if (has(a, 'list')) return { lines: [...c.groups.keys()].sort() };
  if (has(a, 'delete')) {
    const id = need(a, 'group');
    c.deleteGroup(id);
    return { lines: [`Deletion of requested consumer groups ('${id}') was successful.`] };
  }
  if (has(a, 'reset-offsets')) return resetOffsets(c, a);
  if (has(a, 'describe')) {
    const id = need(a, 'group');
    const { group, rows } = c.describeGroup(id);
    const coordinator = coordinatorFor(c, id);
    const lines: string[] = [''];
    if (has(a, 'state')) {
      lines.push(
        ...table(
          ['GROUP', 'COORDINATOR (ID)', 'ASSIGNMENT-STRATEGY', 'STATE', '#MEMBERS'],
          [
            [
              id,
              `broker-${coordinator}:9092 (${coordinator})`,
              group.assignor,
              group.state,
              group.members.size,
            ],
          ],
        ),
      );
      return { lines };
    }
    if (group.members.size === 0) lines.push(`Consumer group '${id}' has no active members.`, '');
    if (has(a, 'members')) {
      lines.push(
        ...table(
          ['GROUP', 'CONSUMER-ID', 'HOST', 'CLIENT-ID', '#PARTITIONS'],
          [...group.members.values()].map((m) => [
            id,
            m.id,
            '/127.0.0.1',
            m.clientId,
            m.assignment.length,
          ]),
        ),
      );
      return { lines };
    }
    lines.push(
      ...table(
        [
          'GROUP',
          'TOPIC',
          'PARTITION',
          'CURRENT-OFFSET',
          'LOG-END-OFFSET',
          'LAG',
          'CONSUMER-ID',
          'HOST',
          'CLIENT-ID',
        ],
        rows.map((r) => [
          id,
          r.topic,
          r.partition,
          r.currentOffset,
          r.logEndOffset,
          r.lag,
          r.member?.id,
          r.member ? '/127.0.0.1' : undefined,
          r.member?.clientId,
        ]),
      ),
    );
    return { lines };
  }
  throw new UsageError(
    'Command must include exactly one action: --list, --describe, --delete, --reset-offsets',
  );
}

/** The group coordinator: the leader of __consumer_offsets partition hash(group) % 50; here, a live broker by hash. */
function coordinatorFor(c: Cluster, group: string): number {
  const ids = c.liveBrokers.map((b) => b.id).sort((x, y) => x - y);
  return ids[toPositive(murmur2(group)) % Math.max(1, ids.length)] ?? -1;
}

function resetOffsets(c: Cluster, a: Args): CliResult {
  const group = need(a, 'group');
  const [topic = '', parts] = need(a, 'topic').split(':');
  const partitions = parts ? parts.split(',').map(Number) : undefined;
  const toOffset = int(a, 'to-offset');
  const shiftBy = int(a, 'shift-by');
  const spec = has(a, 'to-earliest')
    ? ({ to: 'earliest' } as const)
    : has(a, 'to-latest')
      ? ({ to: 'latest' } as const)
      : toOffset !== undefined
        ? { offset: toOffset }
        : shiftBy !== undefined
          ? { shiftBy }
          : null;
  if (!spec)
    throw new UsageError(
      'Option [reset-offsets] takes one of these options: --to-earliest, --to-latest, --to-offset, --shift-by',
    );
  if (!c.groups.has(group)) c.commitOffsets(group, []);
  const plan = c.resetOffsets(group, topic, spec, partitions);
  const lines: string[] = [];
  if (!has(a, 'execute') && !has(a, 'dry-run')) {
    lines.push(
      'WARN: No action will be performed as the --execute option is missing. In a future major release, the default behavior of this command will be to prompt the user before executing the reset rather than doing a dry run. You should add the --dry-run option explicitly if you are scripting this command and want to keep the current default behavior without prompting.',
    );
  }
  if (has(a, 'execute')) c.commitOffsets(group, plan);
  lines.push(
    '',
    ...table(
      ['GROUP', 'TOPIC', 'PARTITION', 'NEW-OFFSET'],
      plan.map((o) => [group, o.topic, o.partition, o.offset]),
    ),
  );
  return { lines };
}

function leaderElection(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, ['all-topic-partitions']);
  const type = (one(a, 'election-type') ?? '').toUpperCase();
  if (type !== 'PREFERRED') {
    throw new UsageError(
      'This simulator runs --election-type PREFERRED (unclean election happens on its own when a topic enables it).',
    );
  }
  const topic = has(a, 'all-topic-partitions') ? undefined : need(a, 'topic');
  const partition = int(a, 'partition');
  const before = new Map(c.allPartitions().map((p) => [`${p.topic}-${p.id}`, p.leader]));
  c.preferredElection(topic, partition);
  const changed = c
    .allPartitions()
    .filter((p) => before.get(`${p.topic}-${p.id}`) !== p.leader)
    .map((p) => `${p.topic}-${p.id}`);
  return {
    lines: changed.length
      ? [`Successfully completed leader election (PREFERRED) for partitions ${changed.join(', ')}`]
      : ['Valid replica already elected for all requested partitions'],
  };
}

function metadataQuorum(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, ['status', 'replication']);
  if (a.positional[0] !== 'describe')
    throw new UsageError('Usage: kafka-metadata-quorum describe --status');
  const voters = [...c.brokers.keys()].sort((x, y) => x - y);
  return {
    lines: [
      'ClusterId:              shiqi-sim-cluster',
      `LeaderId:               ${c.controller ?? -1}`,
      `LeaderEpoch:            ${c.events.filter((e) => e.type === 'controller').length}`,
      `HighWatermark:          ${c.version}`,
      `CurrentVoters:          [${voters.join(',')}]`,
      `CurrentObservers:       []`,
    ],
  };
}

function perfTest(c: Cluster, tokens: string[]): CliResult {
  const a = parseArgs(tokens, []);
  const topic = need(a, 'topic');
  const n = int(a, 'num-records') ?? 100;
  const size = int(a, 'record-size') ?? 100;
  const acks = parseAcks(pairs(a.flags.get('producer-props')).acks);
  const value = 'x'.repeat(Math.max(0, size));
  let ok = 0;
  let errors: string[] = [];
  for (let i = 0; i < Math.min(n, 5000); i++) {
    try {
      c.produce({ topic, value, acks, producer: 'perf-test' });
      ok++;
    } catch (e) {
      errors = sendError(topic, e);
    }
  }
  return {
    lines: [
      ...errors,
      `${ok} records sent, ${(ok * size) / 1024 / 1024 < 0.01 ? '<0.01' : ((ok * size) / 1024 / 1024).toFixed(2)} MB into the leaders' active segments.`,
    ],
  };
}

function broker(c: Cluster, tokens: string[]): CliResult {
  const [action, raw] = tokens;
  const id = Number(raw);
  switch (action) {
    case 'list':
    case undefined:
      return {
        lines: table(
          ['ID', 'STATE', 'RACK', 'ROLE', 'LEADERS', 'REPLICAS'],
          [...c.brokers.values()].map((b) => [
            b.id,
            b.up ? (b.slow ? 'slow' : 'up') : 'down',
            b.rack || undefined,
            c.controller === b.id ? 'controller' : 'broker',
            c.allPartitions().filter((p) => p.leader === b.id).length,
            c.allPartitions().filter((p) => p.replicas.includes(b.id)).length,
          ]),
        ),
      };
    case 'stop':
      c.stopBroker(id);
      return { lines: [fill(CLI_TEXT.brokerStopped, { id })] };
    case 'start':
      c.startBroker(id);
      return { lines: [fill(CLI_TEXT.brokerStarted, { id })] };
    case 'slow':
      c.setBrokerSlow(id, true);
      return { lines: [fill(CLI_TEXT.brokerSlow, { id })] };
    case 'fast':
      c.setBrokerSlow(id, false);
      return { lines: [fill(CLI_TEXT.brokerFast, { id })] };
    case 'add':
      return { lines: [fill(CLI_TEXT.brokerAdded, { id: c.addBroker().id })] };
    default:
      return { lines: [CLI_TEXT.brokerUsage] };
  }
}
