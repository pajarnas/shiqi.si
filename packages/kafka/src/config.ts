// Topic-level configs the simulator honours, under their real Kafka names, with
// parsing and validation shared by the admin API and the CLI.
import { KafkaError } from './types';

export interface TopicConfig {
  'cleanup.policy': 'delete' | 'compact';
  'retention.ms': number;
  'retention.bytes': number;
  'segment.bytes': number;
  'min.insync.replicas': number;
  'delete.retention.ms': number;
  'unclean.leader.election.enable': boolean;
}

export type TopicConfigKey = keyof TopicConfig;

/**
 * Defaults are Kafka's, except retention and segment size: the simulator keeps
 * everything in browser memory, so logs roll and expire at toy scale.
 */
export const TOPIC_DEFAULTS: TopicConfig = {
  'cleanup.policy': 'delete',
  'retention.ms': 10 * 60_000,
  'retention.bytes': -1,
  'segment.bytes': 4096,
  'min.insync.replicas': 1,
  'delete.retention.ms': 60_000,
  'unclean.leader.election.enable': false,
};

type Parser<T> = (raw: string) => T | undefined;

const int: Parser<number> = (raw) => (/^-?\d+$/.test(raw.trim()) ? Number(raw) : undefined);
const bool: Parser<boolean> = (raw) =>
  raw === 'true' ? true : raw === 'false' ? false : undefined;

const PARSERS: { [K in TopicConfigKey]: Parser<TopicConfig[K]> } = {
  'cleanup.policy': (raw) => (raw === 'delete' || raw === 'compact' ? raw : undefined),
  'retention.ms': int,
  'retention.bytes': int,
  'segment.bytes': (raw) => {
    const n = int(raw);
    return n !== undefined && n >= 256 ? n : undefined;
  },
  'min.insync.replicas': (raw) => {
    const n = int(raw);
    return n !== undefined && n >= 1 ? n : undefined;
  },
  'delete.retention.ms': int,
  'unclean.leader.election.enable': bool,
};

export const TOPIC_CONFIG_KEYS = Object.keys(PARSERS) as TopicConfigKey[];

export const isTopicConfigKey = (key: string): key is TopicConfigKey => key in PARSERS;

/** Parse one `key=value`; throws INVALID_CONFIG with a Kafka-like message. */
export function parseTopicConfig<K extends TopicConfigKey>(key: K, raw: string): TopicConfig[K];
export function parseTopicConfig(key: string, raw: string): TopicConfig[TopicConfigKey];
export function parseTopicConfig(key: string, raw: string) {
  if (!isTopicConfigKey(key)) {
    throw new KafkaError('INVALID_CONFIG', `Unknown topic config name: ${key}`);
  }
  const value = PARSERS[key](raw);
  if (value === undefined) {
    throw new KafkaError('INVALID_CONFIG', `Invalid value ${raw} for configuration ${key}`);
  }
  return value;
}

/** Turn `{ 'retention.ms': '1000' }` into a validated partial config. */
export function parseTopicConfigs(raw: Record<string, string>): Partial<TopicConfig> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = parseTopicConfig(k, v);
  return out as Partial<TopicConfig>;
}

/**
 * How a follower that restarts or changes leader decides what to throw away.
 * 'high-watermark' is Kafka before 0.11: cut the log back to the follower's own
 * high watermark. 'leader-epoch' is KIP-101: ask the leader where the epoch of
 * your last record ended and cut there.
 */
export type TruncationMode = 'leader-epoch' | 'high-watermark';

/** Cluster-wide settings, with simulator-friendly timings. */
export interface ClusterSettings {
  /** Seed for every random choice: same seed, same cluster. */
  seed: number;
  /** A follower that hasn't caught up for this long leaves the ISR. */
  replicaLagTimeMaxMs: number;
  /** How often followers fetch from the leader. */
  replicaFetchIntervalMs: number;
  /** Max records a follower takes per fetch. */
  replicaFetchMaxRecords: number;
  /** A slow broker fetches this many times less often. */
  slowFactor: number;
  /** Produce requests with acks=all fail after this long without an ack. */
  requestTimeoutMs: number;
  /** Time the group coordinator waits for members to (re)join. */
  rebalanceDelayMs: number;
  /** A consumer that stops heartbeating is removed after this long. */
  sessionTimeoutMs: number;
  /** How often retention and compaction run. */
  logCleanerIntervalMs: number;
  /** Bytes added to every record for headers, offsets and CRC. */
  recordOverhead: number;
  /** Simulated time advances in steps of this size, so any frame rate replays the same history. */
  tickMs: number;
  /** See TruncationMode. */
  truncation: TruncationMode;
  /**
   * How often a broker's OS writes dirty page-cache pages to disk; -1 = never.
   * Kafka doesn't fsync by default (log.flush.interval.messages is unbounded) and
   * leaves it to the kernel, whose writeback runs every 5 s.
   */
  flushIntervalMs: number;
}

export const CLUSTER_DEFAULTS: ClusterSettings = {
  seed: 1984,
  replicaLagTimeMaxMs: 6_000,
  replicaFetchIntervalMs: 250,
  replicaFetchMaxRecords: 50,
  slowFactor: 40,
  requestTimeoutMs: 10_000,
  rebalanceDelayMs: 1_500,
  sessionTimeoutMs: 8_000,
  logCleanerIntervalMs: 2_000,
  recordOverhead: 20,
  tickMs: 50,
  truncation: 'leader-epoch',
  flushIntervalMs: 5_000,
};
