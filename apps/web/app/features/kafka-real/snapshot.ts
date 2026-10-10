// The real Kafka cluster's API shapes (/api/kafka/*) and the input checks for
// them. Plain data and pure functions, safe to import from the browser.

export interface KafkaBroker {
  id: number;
  host: string;
  rack: string | null;
}

export interface KafkaPartition {
  id: number;
  leader: number;
  replicas: number[];
  isr: number[];
  offlineReplicas: number[];
  logStartOffset: number;
  highWatermark: number;
}

export interface KafkaTopic {
  name: string;
  internal: boolean;
  configs: Record<string, string>;
  partitions: KafkaPartition[];
}

export interface KafkaAssignment {
  topic: string;
  partitions: number[];
}

export interface KafkaMember {
  memberId: string;
  clientId: string;
  host: string;
  assignment: KafkaAssignment[];
}

export interface KafkaCommittedOffset {
  topic: string;
  partition: number;
  committed: number;
}

export interface KafkaGroup {
  id: string;
  state: string;
  protocolType: string;
  assignor: string;
  members: KafkaMember[];
  offsets: KafkaCommittedOffset[];
}

/** GET /api/kafka/snapshot. `at` is an ISO time; `controller` is the active KRaft controller. */
export interface KafkaSnapshot {
  at: string;
  controller: number | null;
  brokers: KafkaBroker[];
  topics: KafkaTopic[];
  groups: KafkaGroup[];
}

/** GET /api/kafka/records: one record; key and value are UTF-8 text (null when absent). */
export interface KafkaRecordView {
  offset: number;
  key: string | null;
  value: string | null;
  timestamp: number;
}

/** Every route answers this, status 503, when there is no cluster to talk to. */
export const UNAVAILABLE = { available: false } as const;

/** Topics the admin API may create, write to, and delete. */
export const LAB_TOPIC_PREFIX = 'lab-';
export const RECORDS_MAX = 50;
export const PRODUCE_MAX = 50;
export const PARTITIONS_MAX = 12;
export const REPLICATION_MAX = 3;
/** Longest key or value stored or shown, in characters. */
export const RECORD_TEXT_MAX = 2000;
/** Topic settings a lab topic may override at creation. */
export const LAB_TOPIC_CONFIGS = [
  'cleanup.policy',
  'retention.ms',
  'retention.bytes',
  'min.insync.replicas',
  'segment.ms',
  'max.message.bytes',
] as const;

const LAB_TOPIC_NAME = /^lab-[A-Za-z0-9._-]{1,60}$/;

export const isLabTopic = (name: unknown): name is string =>
  typeof name === 'string' && LAB_TOPIC_NAME.test(name);

/** Names Kafka keeps for itself, like __consumer_offsets. */
export const isInternalTopic = (name: string) => name.startsWith('__');

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** A whole number in [min, max], from a query string or JSON; `fallback` when absent. */
export function intIn(raw: unknown, min: number, max: number, fallback?: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback ?? null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export interface RecordsQuery {
  topic: string;
  partition: number;
  /** First offset wanted; null means "the latest `limit` records". */
  from: number | null;
  limit: number;
}

export function parseRecordsQuery(params: URLSearchParams): Parsed<RecordsQuery> {
  const topic = params.get('topic');
  if (!topic || topic.length > 249) return fail('topic');
  const partition = intIn(params.get('partition'), 0, 10_000);
  if (partition === null) return fail('partition');
  const fromRaw = params.get('from');
  const from =
    fromRaw === null || fromRaw === '' ? null : intIn(fromRaw, 0, Number.MAX_SAFE_INTEGER);
  if (fromRaw && from === null) return fail('from');
  const limit = intIn(params.get('limit'), 1, RECORDS_MAX, 20);
  if (limit === null) return fail('limit');
  return { ok: true, value: { topic, partition, from, limit } };
}

export interface CreateTopicInput {
  name: string;
  partitions: number;
  replicationFactor: number;
  configs: Record<string, string>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseCreateTopic(body: unknown): Parsed<CreateTopicInput> {
  if (!isObject(body)) return fail('body');
  if (!isLabTopic(body.name)) return fail('name');
  const partitions = intIn(body.partitions, 1, PARTITIONS_MAX, 3);
  if (partitions === null) return fail('partitions');
  const replicationFactor = intIn(body.replicationFactor, 1, REPLICATION_MAX, 3);
  if (replicationFactor === null) return fail('replicationFactor');
  const configs: Record<string, string> = {};
  if (body.configs !== undefined) {
    if (!isObject(body.configs)) return fail('configs');
    for (const [k, v] of Object.entries(body.configs)) {
      if (!(LAB_TOPIC_CONFIGS as readonly string[]).includes(k)) return fail(`configs.${k}`);
      if (typeof v !== 'string' && typeof v !== 'number') return fail(`configs.${k}`);
      configs[k] = String(v).slice(0, 100);
    }
  }
  return { ok: true, value: { name: body.name, partitions, replicationFactor, configs } };
}

export interface ProduceMessage {
  key: string | null;
  value: string | null;
  partition?: number;
}

export interface ProduceInput {
  topic: string;
  messages: ProduceMessage[];
}

const textOrNull = (v: unknown): string | null | undefined =>
  v === undefined || v === null
    ? null
    : typeof v === 'string' && v.length <= RECORD_TEXT_MAX
      ? v
      : undefined;

/** Either `{ topic, key?, value, partition? }` or `{ topic, messages: [...] }`. */
export function parseProduce(body: unknown): Parsed<ProduceInput> {
  if (!isObject(body)) return fail('body');
  if (!isLabTopic(body.topic)) return fail('topic');
  const list = body.messages === undefined ? [body] : body.messages;
  if (!Array.isArray(list) || list.length < 1 || list.length > PRODUCE_MAX) return fail('messages');
  const messages: ProduceMessage[] = [];
  for (const m of list) {
    if (!isObject(m)) return fail('messages');
    const key = textOrNull(m.key);
    const value = textOrNull(m.value);
    if (key === undefined) return fail('key');
    if (value === undefined) return fail('value');
    const partition = intIn(m.partition, 0, PARTITIONS_MAX - 1);
    if (m.partition !== undefined && partition === null) return fail('partition');
    messages.push(partition === null ? { key, value } : { key, value, partition });
  }
  return { ok: true, value: { topic: body.topic, messages } };
}
