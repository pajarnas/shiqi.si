// Every command the CLI emulator understands, described as a form: which
// fields it takes and how they turn into a command line. A UI renders the
// fields, the reader clicks, and the command it would type appears, token by
// token, each token knowing which field wrote it.
import type { Cluster } from './cluster';
import { TOPIC_DEFAULTS, type TopicConfigKey } from './config';

export type CommandGroup = 'topics' | 'produce' | 'consume' | 'groups' | 'security' | 'cluster';

export type FieldKind =
  /** An existing topic. */
  | 'topic'
  /** An existing consumer group. */
  | 'group'
  /** A broker id. */
  | 'broker'
  /** `User:<name>` of a client in the cluster, or `User:*`. */
  | 'principal'
  | 'int'
  | 'text'
  | 'choice'
  | 'switch';

export interface CommandField {
  id: string;
  kind: FieldKind;
  /** For 'choice'. */
  choices?: readonly string[];
  min?: number;
  max?: number;
  /** May be left empty; the command then leaves its flag out. */
  optional?: boolean;
  /** Shown only when another field has one of these values. */
  when?: { field: string; is: readonly (string | boolean)[] };
}

export type FieldValue = string | number | boolean;
export type CommandValues = Record<string, FieldValue>;

/** One word of the command line, and the field it came from. */
export interface CommandToken {
  text: string;
  field?: string;
}

export interface CommandSpec {
  id: string;
  group: CommandGroup;
  fields: readonly CommandField[];
  /** Starting values; may read the cluster for names that exist. */
  defaults: (c: Cluster) => CommandValues;
  build: (v: CommandValues) => CommandToken[];
}

const CONFIG_KEYS = Object.keys(TOPIC_DEFAULTS) as TopicConfigKey[];
const ACKS = ['all', '1', '0'] as const;

const firstTopic = (c: Cluster) => [...c.topics.keys()].sort()[0] ?? '';
const firstGroup = (c: Cluster) => [...c.groups.keys()].sort()[0] ?? '';
const firstBroker = (c: Cluster) => [...c.brokers.keys()].sort((a, b) => a - b)[0] ?? 1;

/** Quote a value the way a shell would need it. */
export const shellQuote = (s: string) =>
  s !== '' && !/[\s'"\\$`]/.test(s) ? s : s.includes("'") ? `"${s}"` : `'${s}'`;

const word = (text: string): CommandToken => ({ text });
const arg = (flag: string, field: string, value: FieldValue): CommandToken[] => [
  { text: `--${flag}`, field },
  { text: shellQuote(String(value)), field },
];
const sw = (flag: string, field: string): CommandToken => ({ text: `--${flag}`, field });
const has = (v: FieldValue | undefined) => v !== undefined && v !== '' && v !== false;

export const COMMAND_SPECS: readonly CommandSpec[] = [
  // ── Topics ──
  {
    id: 'topicCreate',
    group: 'topics',
    fields: [
      { id: 'name', kind: 'text' },
      { id: 'partitions', kind: 'int', min: 1, max: 12 },
      { id: 'replicationFactor', kind: 'int', min: 1, max: 5 },
      { id: 'configKey', kind: 'choice', choices: ['', ...CONFIG_KEYS], optional: true },
      { id: 'configValue', kind: 'text', when: { field: 'configKey', is: CONFIG_KEYS } },
    ],
    defaults: (c) => ({
      name: 'payments',
      partitions: 3,
      replicationFactor: Math.min(3, c.liveBrokers.length),
      configKey: '',
      configValue: '',
    }),
    build: (v) => [
      word('kafka-topics'),
      sw('create', 'name'),
      ...arg('topic', 'name', v.name ?? ''),
      ...arg('partitions', 'partitions', v.partitions ?? 1),
      ...arg('replication-factor', 'replicationFactor', v.replicationFactor ?? 1),
      ...(has(v.configKey)
        ? arg('config', 'configKey', `${String(v.configKey)}=${String(v.configValue ?? '')}`)
        : []),
    ],
  },
  {
    id: 'topicDescribe',
    group: 'topics',
    fields: [
      { id: 'topic', kind: 'topic', optional: true },
      {
        id: 'only',
        kind: 'choice',
        choices: ['', 'under-replicated-partitions', 'unavailable-partitions'],
        optional: true,
      },
    ],
    defaults: (c) => ({ topic: firstTopic(c), only: '' }),
    build: (v) => [
      word('kafka-topics'),
      word('--describe'),
      ...(has(v.topic) ? arg('topic', 'topic', v.topic as string) : []),
      ...(has(v.only) ? [sw(String(v.only), 'only')] : []),
    ],
  },
  {
    id: 'topicList',
    group: 'topics',
    fields: [],
    defaults: () => ({}),
    build: () => [word('kafka-topics'), word('--list')],
  },
  {
    id: 'topicAddPartitions',
    group: 'topics',
    fields: [
      { id: 'topic', kind: 'topic' },
      { id: 'partitions', kind: 'int', min: 1, max: 12 },
    ],
    defaults: (c) => ({
      topic: firstTopic(c),
      partitions: (c.topics.get(firstTopic(c))?.partitions.length ?? 1) + 1,
    }),
    build: (v) => [
      word('kafka-topics'),
      word('--alter'),
      ...arg('topic', 'topic', v.topic ?? ''),
      ...arg('partitions', 'partitions', v.partitions ?? 1),
    ],
  },
  {
    id: 'topicConfig',
    group: 'topics',
    fields: [
      { id: 'topic', kind: 'topic' },
      { id: 'configKey', kind: 'choice', choices: CONFIG_KEYS },
      { id: 'configValue', kind: 'text' },
    ],
    defaults: (c) => ({ topic: firstTopic(c), configKey: 'retention.ms', configValue: '60000' }),
    build: (v) => [
      word('kafka-configs'),
      word('--entity-type'),
      word('topics'),
      ...arg('entity-name', 'topic', v.topic ?? ''),
      sw('alter', 'configKey'),
      ...arg('add-config', 'configValue', `${String(v.configKey)}=${String(v.configValue ?? '')}`),
    ],
  },
  {
    id: 'topicDelete',
    group: 'topics',
    fields: [{ id: 'topic', kind: 'topic' }],
    defaults: (c) => ({ topic: firstTopic(c) }),
    build: (v) => [word('kafka-topics'), word('--delete'), ...arg('topic', 'topic', v.topic ?? '')],
  },

  // ── Produce ──
  {
    id: 'consoleProducer',
    group: 'produce',
    fields: [
      { id: 'topic', kind: 'topic' },
      { id: 'acks', kind: 'choice', choices: ACKS },
      { id: 'withKeys', kind: 'switch' },
    ],
    defaults: (c) => ({ topic: firstTopic(c), acks: 'all', withKeys: true }),
    build: (v) => [
      word('kafka-console-producer'),
      ...arg('topic', 'topic', v.topic ?? ''),
      ...arg('producer-property', 'acks', `acks=${String(v.acks)}`),
      ...(v.withKeys
        ? [
            ...arg('property', 'withKeys', 'parse.key=true'),
            ...arg('property', 'withKeys', 'key.separator=:'),
          ]
        : []),
    ],
  },
  {
    id: 'perfTest',
    group: 'produce',
    fields: [
      { id: 'topic', kind: 'topic' },
      { id: 'records', kind: 'int', min: 1, max: 5000 },
      { id: 'recordSize', kind: 'int', min: 1, max: 10000 },
      { id: 'acks', kind: 'choice', choices: ACKS },
    ],
    defaults: (c) => ({ topic: firstTopic(c), records: 100, recordSize: 100, acks: '1' }),
    build: (v) => [
      word('kafka-producer-perf-test'),
      ...arg('topic', 'topic', v.topic ?? ''),
      ...arg('num-records', 'records', v.records ?? 100),
      ...arg('record-size', 'recordSize', v.recordSize ?? 100),
      ...arg('producer-props', 'acks', `acks=${String(v.acks)}`),
    ],
  },

  // ── Consume ──
  {
    id: 'consoleConsumer',
    group: 'consume',
    fields: [
      { id: 'topic', kind: 'topic' },
      { id: 'groupName', kind: 'text', optional: true },
      { id: 'fromBeginning', kind: 'switch' },
      { id: 'maxMessages', kind: 'int', min: 1, max: 1000, optional: true },
      { id: 'printKey', kind: 'switch' },
      { id: 'printPartition', kind: 'switch' },
      { id: 'printOffset', kind: 'switch' },
    ],
    defaults: (c) => ({
      topic: firstTopic(c),
      groupName: '',
      fromBeginning: true,
      maxMessages: 10,
      printKey: true,
      printPartition: true,
      printOffset: true,
    }),
    build: (v) => [
      word('kafka-console-consumer'),
      ...arg('topic', 'topic', v.topic ?? ''),
      ...(has(v.groupName) ? arg('group', 'groupName', v.groupName as string) : []),
      ...(v.fromBeginning ? [sw('from-beginning', 'fromBeginning')] : []),
      ...(has(v.maxMessages) ? arg('max-messages', 'maxMessages', v.maxMessages as number) : []),
      ...(v.printKey ? arg('property', 'printKey', 'print.key=true') : []),
      ...(v.printPartition ? arg('property', 'printPartition', 'print.partition=true') : []),
      ...(v.printOffset ? arg('property', 'printOffset', 'print.offset=true') : []),
    ],
  },

  // ── Consumer groups ──
  {
    id: 'groupDescribe',
    group: 'groups',
    fields: [
      { id: 'group', kind: 'group' },
      { id: 'view', kind: 'choice', choices: ['offsets', 'members', 'state'] },
    ],
    defaults: (c) => ({ group: firstGroup(c), view: 'offsets' }),
    build: (v) => [
      word('kafka-consumer-groups'),
      word('--describe'),
      ...arg('group', 'group', v.group ?? ''),
      ...(v.view === 'offsets' ? [] : [sw(String(v.view), 'view')]),
    ],
  },
  {
    id: 'groupList',
    group: 'groups',
    fields: [],
    defaults: () => ({}),
    build: () => [word('kafka-consumer-groups'), word('--list')],
  },
  {
    // A group's seek: move its committed offsets. Kafka only allows it while the group is empty.
    id: 'groupSeek',
    group: 'groups',
    fields: [
      { id: 'group', kind: 'group' },
      { id: 'topic', kind: 'topic' },
      { id: 'partition', kind: 'int', min: 0, max: 11, optional: true },
      { id: 'to', kind: 'choice', choices: ['earliest', 'latest', 'offset', 'shift'] },
      {
        id: 'amount',
        kind: 'int',
        min: -100000,
        max: 100000,
        when: { field: 'to', is: ['offset', 'shift'] },
      },
      { id: 'mode', kind: 'choice', choices: ['dry-run', 'execute'] },
    ],
    defaults: (c) => {
      const group = c.groups.get(firstGroup(c));
      return {
        group: firstGroup(c),
        topic: [...(group?.members.values() ?? [])][0]?.topics[0] ?? firstTopic(c),
        partition: '',
        to: 'earliest',
        amount: 0,
        mode: 'dry-run',
      };
    },
    build: (v) => [
      word('kafka-consumer-groups'),
      word('--reset-offsets'),
      ...arg('group', 'group', v.group ?? ''),
      ...arg(
        'topic',
        has(v.partition) ? 'partition' : 'topic',
        has(v.partition) ? `${String(v.topic)}:${String(v.partition)}` : (v.topic ?? ''),
      ),
      ...(v.to === 'offset'
        ? arg('to-offset', 'amount', v.amount ?? 0)
        : v.to === 'shift'
          ? arg('shift-by', 'amount', v.amount ?? 0)
          : [sw(`to-${String(v.to)}`, 'to')]),
      sw(String(v.mode), 'mode'),
    ],
  },
  {
    id: 'groupDelete',
    group: 'groups',
    fields: [{ id: 'group', kind: 'group' }],
    defaults: (c) => ({ group: firstGroup(c) }),
    build: (v) => [
      word('kafka-consumer-groups'),
      word('--delete'),
      ...arg('group', 'group', v.group ?? ''),
    ],
  },

  // ── Security ──
  {
    id: 'authorizer',
    group: 'security',
    fields: [{ id: 'state', kind: 'choice', choices: ['on', 'off'] }],
    defaults: (c) => ({ state: c.authorizer ? 'off' : 'on' }),
    build: (v) => [word('authorizer'), { text: String(v.state), field: 'state' }],
  },
  {
    id: 'aclAdd',
    group: 'security',
    fields: [
      { id: 'permission', kind: 'choice', choices: ['allow', 'deny'] },
      { id: 'principal', kind: 'principal' },
      { id: 'operation', kind: 'choice', choices: ['Read', 'Write', 'Describe', 'All'] },
      { id: 'resource', kind: 'choice', choices: ['topic', 'group'] },
      { id: 'topic', kind: 'topic', when: { field: 'resource', is: ['topic'] } },
      { id: 'group', kind: 'group', when: { field: 'resource', is: ['group'] } },
      { id: 'pattern', kind: 'choice', choices: ['literal', 'prefixed'] },
    ],
    defaults: (c) => ({
      permission: 'allow',
      principal: principalsIn(c)[0] ?? 'User:*',
      operation: 'Read',
      resource: 'topic',
      topic: firstTopic(c),
      group: firstGroup(c),
      pattern: 'literal',
    }),
    build: (v) => aclTokens('add', v),
  },
  {
    id: 'aclRemove',
    group: 'security',
    fields: [
      { id: 'permission', kind: 'choice', choices: ['allow', 'deny'] },
      { id: 'principal', kind: 'principal' },
      { id: 'operation', kind: 'choice', choices: ['Read', 'Write', 'Describe', 'All'] },
      { id: 'resource', kind: 'choice', choices: ['topic', 'group'] },
      { id: 'topic', kind: 'topic', when: { field: 'resource', is: ['topic'] } },
      { id: 'group', kind: 'group', when: { field: 'resource', is: ['group'] } },
      { id: 'pattern', kind: 'choice', choices: ['literal', 'prefixed'] },
    ],
    defaults: (c) => {
      const a = c.acls[0];
      return {
        permission: a?.permission === 'Deny' ? 'deny' : 'allow',
        principal: a?.principal ?? principalsIn(c)[0] ?? 'User:*',
        operation: a?.operation ?? 'Read',
        resource: a?.resource ?? 'topic',
        topic: a?.resource === 'topic' ? a.name : firstTopic(c),
        group: a?.resource === 'group' ? a.name : firstGroup(c),
        pattern: a?.pattern ?? 'literal',
      };
    },
    build: (v) => aclTokens('remove', v),
  },
  {
    id: 'aclList',
    group: 'security',
    fields: [],
    defaults: () => ({}),
    build: () => [word('kafka-acls'), word('--list')],
  },

  // ── Cluster ──
  {
    id: 'brokerControl',
    group: 'cluster',
    fields: [
      { id: 'action', kind: 'choice', choices: ['stop', 'start', 'slow', 'fast'] },
      { id: 'broker', kind: 'broker' },
    ],
    defaults: (c) => ({ action: 'stop', broker: firstBroker(c) }),
    build: (v) => [
      word('broker'),
      { text: String(v.action), field: 'action' },
      { text: String(v.broker), field: 'broker' },
    ],
  },
  {
    id: 'brokerAdd',
    group: 'cluster',
    fields: [],
    defaults: () => ({}),
    build: () => [word('broker'), word('add')],
  },
  {
    id: 'brokerList',
    group: 'cluster',
    fields: [],
    defaults: () => ({}),
    build: () => [word('broker'), word('list')],
  },
  {
    id: 'leaderElection',
    group: 'cluster',
    fields: [
      { id: 'scope', kind: 'choice', choices: ['all', 'one'] },
      { id: 'topic', kind: 'topic', when: { field: 'scope', is: ['one'] } },
      { id: 'partition', kind: 'int', min: 0, max: 11, when: { field: 'scope', is: ['one'] } },
    ],
    defaults: (c) => ({ scope: 'all', topic: firstTopic(c), partition: 0 }),
    build: (v) => [
      word('kafka-leader-election'),
      word('--election-type'),
      word('PREFERRED'),
      ...(v.scope === 'one'
        ? [
            ...arg('topic', 'topic', v.topic ?? ''),
            ...arg('partition', 'partition', v.partition ?? 0),
          ]
        : [sw('all-topic-partitions', 'scope')]),
    ],
  },
  {
    id: 'quorum',
    group: 'cluster',
    fields: [],
    defaults: () => ({}),
    build: () => [word('kafka-metadata-quorum'), word('describe'), word('--status')],
  },
];

export const COMMAND_GROUPS: readonly CommandGroup[] = [
  'topics',
  'produce',
  'consume',
  'groups',
  'security',
  'cluster',
];

/** Every principal a client in the cluster authenticates as, then `User:*`. */
export function principalsIn(c: Cluster): string[] {
  const names = new Set<string>();
  for (const p of c.producers.values()) names.add(p.principal);
  for (const g of c.groups.values()) for (const m of g.members.values()) names.add(m.principal);
  return [...[...names].sort(), 'User:*'];
}

function aclTokens(action: 'add' | 'remove', v: CommandValues): CommandToken[] {
  const resource = v.resource === 'group' ? 'group' : 'topic';
  return [
    word('kafka-acls'),
    word(`--${action}`),
    ...arg(`${String(v.permission)}-principal`, 'principal', v.principal ?? 'User:*'),
    ...arg('operation', 'operation', v.operation ?? 'Read'),
    ...arg(resource, resource, v[resource] ?? ''),
    ...(v.pattern === 'prefixed' ? arg('resource-pattern-type', 'pattern', 'prefixed') : []),
  ];
}

export const commandSpec = (id: string) => COMMAND_SPECS.find((s) => s.id === id);

/** Whether a field applies, given the other values. */
export const fieldShown = (f: CommandField, v: CommandValues) =>
  !f.when || f.when.is.includes(v[f.when.field] as string | boolean);

export const commandLine = (tokens: readonly CommandToken[]) => tokens.map((t) => t.text).join(' ');
