// Shared shapes of the simulated cluster. Names follow Kafka's own vocabulary
// (LEO, HW, ISR, generation...) so the docs and the CLI read the same.

export type BrokerId = number;

/** acks: 0 = fire and forget, 1 = leader wrote it, 'all' = every ISR replica has it. */
export type Acks = 0 | 1 | 'all';

export interface KRecord {
  offset: number;
  key: string | null;
  /** null is a tombstone on a compacted topic. */
  value: string | null;
  /** Simulated ms since the cluster started. */
  timestamp: number;
  /** Bytes on disk, including a fixed per-record overhead. */
  size: number;
  /** Leader epoch the record was written in; used to truncate diverged followers. */
  leaderEpoch: number;
  /** Who produced it (producer id, or 'cli'). */
  producer: string;
}

export interface TopicPartition {
  topic: string;
  partition: number;
}

export const tpKey = (topic: string, partition: number) => `${topic}-${partition}`;

/** Error codes as the Java client names them. */
export type KafkaErrorCode =
  | 'UNKNOWN_TOPIC_OR_PARTITION'
  | 'LEADER_NOT_AVAILABLE'
  | 'NOT_ENOUGH_REPLICAS'
  | 'REQUEST_TIMED_OUT'
  | 'NOT_LEADER_OR_FOLLOWER'
  | 'INVALID_RECORD'
  | 'TOPIC_ALREADY_EXISTS'
  | 'INVALID_REPLICATION_FACTOR'
  | 'INVALID_PARTITIONS'
  | 'INVALID_CONFIG'
  | 'GROUP_ID_NOT_FOUND'
  | 'NON_EMPTY_GROUP'
  | 'BROKER_NOT_AVAILABLE';

export class KafkaError extends Error {
  constructor(
    readonly code: KafkaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'KafkaError';
  }
}

export type GroupState = 'Empty' | 'PreparingRebalance' | 'CompletingRebalance' | 'Stable' | 'Dead';

export type Assignor = 'range' | 'roundrobin' | 'cooperative-sticky';

export type OffsetReset = 'earliest' | 'latest';

/** Everything that happens in the cluster, in order. Views animate these. */
export type ClusterEvent =
  | {
      type: 'produce';
      at: number;
      producer: string;
      topic: string;
      partition: number;
      broker: BrokerId;
      offset: number;
      key: string | null;
    }
  | {
      type: 'ack';
      at: number;
      producer: string;
      topic: string;
      partition: number;
      offset: number;
      error?: KafkaErrorCode;
    }
  | {
      type: 'replicate';
      at: number;
      topic: string;
      partition: number;
      from: BrokerId;
      to: BrokerId;
      fromOffset: number;
      count: number;
    }
  | {
      type: 'consume';
      at: number;
      group: string;
      member: string;
      topic: string;
      partition: number;
      broker: BrokerId;
      fromOffset: number;
      count: number;
    }
  | { type: 'commit'; at: number; group: string; topic: string; partition: number; offset: number }
  | {
      type: 'isr-shrink' | 'isr-expand';
      at: number;
      topic: string;
      partition: number;
      broker: BrokerId;
      isr: BrokerId[];
    }
  | {
      type: 'leader-elected';
      at: number;
      topic: string;
      partition: number;
      leader: BrokerId | null;
      epoch: number;
      unclean: boolean;
    }
  | {
      type: 'truncate';
      at: number;
      topic: string;
      partition: number;
      broker: BrokerId;
      to: number;
      lost: number;
    }
  | { type: 'broker-down' | 'broker-up' | 'controller'; at: number; broker: BrokerId }
  | { type: 'broker-slow'; at: number; broker: BrokerId; slow: boolean }
  | {
      type: 'rebalance-start';
      at: number;
      group: string;
      generation: number;
      reason: 'join' | 'leave' | 'timeout' | 'metadata';
    }
  | { type: 'rebalance-end'; at: number; group: string; generation: number; members: number }
  | {
      type: 'segment-deleted';
      at: number;
      topic: string;
      partition: number;
      broker: BrokerId;
      baseOffset: number;
      count: number;
    }
  | {
      type: 'compacted';
      at: number;
      topic: string;
      partition: number;
      broker: BrokerId;
      removed: number;
    }
  | {
      type: 'offset-reset';
      at: number;
      group: string;
      topic: string;
      partition: number;
      to: number;
    }
  | { type: 'topic-created' | 'topic-deleted'; at: number; topic: string }
  | { type: 'partitions-added'; at: number; topic: string; count: number }
  | { type: 'config-changed'; at: number; topic: string; key: string; value: string };

export type ClusterEventType = ClusterEvent['type'];
