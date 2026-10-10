// What the real-cluster view derives from /api/kafka/snapshot: which replicas
// each broker hosts, consumer lag, and records per second between two polls.
// Pure functions, so the page and the tests share them.
import type { KafkaGroup, KafkaPartition, KafkaSnapshot, KafkaTopic } from './snapshot';

export type ReplicaRole = 'leader' | 'follower' | 'out' | 'offline';

export interface HostedReplica {
  topic: string;
  partition: number;
  role: ReplicaRole;
}

/** A replica's state as the broker hosting it sees it. */
export function replicaRole(p: KafkaPartition, broker: number): ReplicaRole {
  if (p.offlineReplicas.includes(broker)) return 'offline';
  if (p.leader === broker) return 'leader';
  return p.isr.includes(broker) ? 'follower' : 'out';
}

/** Every replica each broker hosts, by broker id, in topic then partition order. */
export function replicasByBroker(
  snapshot: KafkaSnapshot,
  showInternal: boolean,
): Map<number, HostedReplica[]> {
  const out = new Map<number, HostedReplica[]>(snapshot.brokers.map((b) => [b.id, []]));
  for (const t of visibleTopics(snapshot, showInternal))
    for (const p of t.partitions)
      for (const id of p.replicas)
        out.get(id)?.push({ topic: t.name, partition: p.id, role: replicaRole(p, id) });
  return out;
}

export const visibleTopics = (snapshot: KafkaSnapshot, showInternal: boolean): KafkaTopic[] =>
  snapshot.topics.filter((t) => showInternal || !t.internal);

/** Partitions whose ISR is smaller than their replica set. */
export const underReplicated = (snapshot: KafkaSnapshot) =>
  snapshot.topics.reduce(
    (n, t) => n + t.partitions.filter((p) => p.isr.length < p.replicas.length).length,
    0,
  );

export interface PartitionLag {
  topic: string;
  partition: number;
  committed: number;
  highWatermark: number;
  lag: number;
}

/** How far each of a group's committed offsets is behind its partition's high watermark. */
export function groupLag(group: KafkaGroup, topics: readonly KafkaTopic[]): PartitionLag[] {
  return group.offsets.map((o) => {
    const p = topics.find((t) => t.name === o.topic)?.partitions.find((x) => x.id === o.partition);
    const highWatermark = p?.highWatermark ?? o.committed;
    return { ...o, highWatermark, lag: Math.max(0, highWatermark - o.committed) };
  });
}

export const partitionKey = (topic: string, partition: number) => `${topic}/${partition}`;

/** Records per second each partition took between two snapshots, by `partitionKey`. */
export function produceRates(prev: KafkaSnapshot | null, next: KafkaSnapshot): Map<string, number> {
  const rates = new Map<string, number>();
  if (!prev) return rates;
  const seconds = (Date.parse(next.at) - Date.parse(prev.at)) / 1000;
  if (!(seconds > 0)) return rates;
  const before = new Map<string, number>();
  for (const t of prev.topics)
    for (const p of t.partitions) before.set(partitionKey(t.name, p.id), p.highWatermark);
  for (const t of next.topics)
    for (const p of t.partitions) {
      const key = partitionKey(t.name, p.id);
      const was = before.get(key);
      if (was !== undefined) rates.set(key, Math.max(0, p.highWatermark - was) / seconds);
    }
  return rates;
}

/**
 * Where a position falls on a partition's bar, 0 to 1. The bar runs from the
 * log start offset to the high watermark; an empty log puts everything at 1.
 */
export function barPosition(p: KafkaPartition, offset: number): number {
  const span = p.highWatermark - p.logStartOffset;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (offset - p.logStartOffset) / span));
}
