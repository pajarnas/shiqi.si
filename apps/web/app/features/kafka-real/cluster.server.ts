// What the /api/kafka routes ask of the real cluster, written against KafkaPort
// so tests can hand in a fake one.
import type { KafkaPort } from './client.server';
import {
  type CreateTopicInput,
  type KafkaGroup,
  type KafkaRecordView,
  type KafkaSnapshot,
  type KafkaTopic,
  type ProduceInput,
  type RecordsQuery,
  RECORD_TEXT_MAX,
  isInternalTopic,
  isLabTopic,
} from './snapshot';

type Metadata = Awaited<ReturnType<KafkaPort['metadata']>>;
type TopicMeta = Metadata['topics'][number] & { name: string };
type OffsetsResponse = Awaited<ReturnType<KafkaPort['listOffsets']>>;

const TOPIC_RESOURCE = 2; // ConfigResourceTypes.TOPIC
const DEFAULT_CONFIG = 5; // ConfigSources.DEFAULT_CONFIG
const EARLIEST = -2n;
const LATEST = -1n;
/** Always shown, even at their defaults; anything else only when overridden. */
const KEY_CONFIGS = new Set([
  'cleanup.policy',
  'retention.ms',
  'retention.bytes',
  'min.insync.replicas',
]);
/** Most lab topics allowed at once, so a busy afternoon can't fill the disk. */
export const LAB_TOPICS_MAX = 20;

const num = (n: bigint | number) => Number(n);

/** Topics the cluster knows, by name, sorted. */
const knownTopics = (meta: Metadata): TopicMeta[] =>
  meta.topics
    .filter((t): t is TopicMeta => !!t.name && t.errorCode === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

async function topicConfigs(port: KafkaPort, names: string[]) {
  if (!names.length) return new Map<string, Record<string, string>>();
  const described = await port.admin.describeConfigs({
    resources: names.map((resourceName) => ({
      resourceType: TOPIC_RESOURCE,
      resourceName,
      configurationKeys: [],
    })),
  });
  return new Map(
    described.map((d) => [
      d.resourceName,
      Object.fromEntries(
        d.configs
          .filter((c) => c.value !== null && !c.isSensitive)
          .filter((c) => KEY_CONFIGS.has(c.name) || c.configSource !== DEFAULT_CONFIG)
          .map((c) => [c.name, c.value as string]),
      ),
    ]),
  );
}

/**
 * The offset at `at` (EARLIEST or LATEST) of every partition of `topics`,
 * keyed "topic/partition", asking each partition's leader. Partitions without
 * a leader, or whose leader doesn't answer, are left out.
 */
async function offsets(port: KafkaPort, meta: Metadata, topics: TopicMeta[], at: bigint) {
  const byLeader = new Map<number, Map<string, number[]>>();
  for (const t of topics)
    for (const p of t.partitions) {
      if (p.leaderId < 0) continue;
      const mine = byLeader.get(p.leaderId) ?? new Map<string, number[]>();
      mine.set(t.name, [...(mine.get(t.name) ?? []), p.partitionIndex]);
      byLeader.set(p.leaderId, mine);
    }
  const out = new Map<string, number>();
  await Promise.all(
    [...byLeader].map(async ([leader, wanted]) => {
      const broker = meta.brokers.find((b) => b.nodeId === leader);
      if (!broker) return;
      const request = [...wanted].map(([name, partitions]) => ({
        name,
        partitions: partitions.map((partitionIndex) => ({
          partitionIndex,
          currentLeaderEpoch: -1,
          timestamp: at,
        })),
      }));
      let res: OffsetsResponse | undefined;
      try {
        res = await port.listOffsets({ host: broker.host, port: broker.port }, request);
      } catch (err) {
        // Some partitions failed (say, leadership just moved); keep the rest.
        res = (err as { response?: OffsetsResponse }).response;
      }
      for (const t of res?.topics ?? [])
        for (const p of t.partitions)
          if (p.errorCode === 0) out.set(`${t.name}/${p.partitionIndex}`, num(p.offset));
    }),
  );
  return out;
}

async function groups(port: KafkaPort): Promise<KafkaGroup[]> {
  const ids = [...(await port.admin.listGroups()).keys()].sort();
  if (!ids.length) return [];
  const [described, committed] = await Promise.all([
    port.admin.describeGroups({ groups: ids }),
    port.admin.listConsumerGroupOffsets({ groups: ids }),
  ]);
  const committedBy = new Map(committed.map((g) => [g.groupId, g.topics]));
  return ids.flatMap((id) => {
    const g = described.get(id);
    if (!g) return [];
    return [
      {
        id,
        state: g.state,
        protocolType: g.protocolType,
        assignor: g.protocol,
        members: [...g.members.values()].map((m) => ({
          memberId: m.id,
          clientId: m.clientId,
          host: m.clientHost.replace(/^\//, ''),
          assignment: [...(m.assignments?.values() ?? [])].map((a) => ({
            topic: a.topic,
            partitions: [...a.partitions].sort((x, y) => x - y),
          })),
        })),
        offsets: (committedBy.get(id) ?? []).flatMap((t) =>
          t.partitions
            .filter((p) => p.committedOffset >= 0n)
            .map((p) => ({
              topic: t.name,
              partition: p.partitionIndex,
              committed: num(p.committedOffset),
            })),
        ),
      },
    ];
  });
}

export async function readSnapshot(port: KafkaPort, now = new Date()): Promise<KafkaSnapshot> {
  const meta = await port.metadata();
  const known = knownTopics(meta);
  const [configs, starts, ends, groupList, controller] = await Promise.all([
    topicConfigs(
      port,
      known.map((t) => t.name),
    ),
    offsets(port, meta, known, EARLIEST),
    offsets(port, meta, known, LATEST),
    groups(port),
    port.controller(),
  ]);
  const topics: KafkaTopic[] = known.map((t) => ({
    name: t.name,
    internal: t.isInternal || isInternalTopic(t.name),
    configs: configs.get(t.name) ?? {},
    partitions: [...t.partitions]
      .sort((a, b) => a.partitionIndex - b.partitionIndex)
      .map((p) => ({
        id: p.partitionIndex,
        leader: p.leaderId,
        replicas: p.replicaNodes,
        isr: p.isrNodes,
        offlineReplicas: p.offlineReplicas,
        logStartOffset: starts.get(`${t.name}/${p.partitionIndex}`) ?? 0,
        highWatermark: ends.get(`${t.name}/${p.partitionIndex}`) ?? 0,
      })),
  }));
  return {
    at: now.toISOString(),
    controller: controller ?? (meta.controllerId >= 0 ? meta.controllerId : null),
    brokers: meta.brokers
      .map((b) => ({ id: b.nodeId, host: b.host, rack: b.rack ?? null }))
      .sort((a, b) => a.id - b.id),
    topics,
    groups: groupList,
  };
}

const text = (b: Buffer | null) =>
  b === null ? null : b.toString('utf8').slice(0, RECORD_TEXT_MAX);

/** Records from one partition, read straight from its leader. Null when the topic or partition doesn't exist. */
export async function readRecords(
  port: KafkaPort,
  q: RecordsQuery,
): Promise<KafkaRecordView[] | null> {
  const meta = await port.metadata();
  const topic = knownTopics(meta).find((t) => t.name === q.topic);
  const partition = topic?.partitions.find((p) => p.partitionIndex === q.partition);
  if (!topic || !partition) return null;
  const only = [{ ...topic, partitions: [partition] }];
  const [starts, ends] = await Promise.all([
    offsets(port, meta, only, EARLIEST),
    offsets(port, meta, only, LATEST),
  ]);
  const key = `${q.topic}/${q.partition}`;
  const start = starts.get(key) ?? 0;
  const end = ends.get(key) ?? 0;
  const from = Math.max(start, q.from ?? end - q.limit);
  if (from >= end) return [];
  const res = await port.reader.fetch({
    node: partition.leaderId,
    maxWaitTime: 0,
    minBytes: 0,
    maxBytes: 1 << 20,
    topics: [
      {
        topicId: topic.topicId,
        partitions: [
          {
            partition: q.partition,
            fetchOffset: BigInt(from),
            currentLeaderEpoch: -1,
            lastFetchedEpoch: -1,
            partitionMaxBytes: 1 << 20,
          },
        ],
      },
    ],
  });
  const out: KafkaRecordView[] = [];
  for (const batch of res.responses[0]?.partitions[0]?.records ?? []) {
    for (const r of batch.records) {
      const offset = num(batch.firstOffset) + r.offsetDelta;
      // A fetch starts at the batch holding `from`, so skip what comes before it.
      if (offset < from) continue;
      out.push({
        offset,
        key: text(r.key),
        value: text(r.value),
        timestamp: num(batch.firstTimestamp + r.timestampDelta),
      });
      if (out.length === q.limit) return out;
    }
  }
  return out;
}

/** 'limit' when there are already LAB_TOPICS_MAX lab topics. */
export async function createLabTopic(port: KafkaPort, input: CreateTopicInput) {
  const existing = knownTopics(await port.metadata()).filter((t) => isLabTopic(t.name));
  if (existing.length >= LAB_TOPICS_MAX) return 'limit' as const;
  const [created] = await port.admin.createTopics({
    topics: [input.name],
    partitions: input.partitions,
    replicas: input.replicationFactor,
    configs: Object.entries(input.configs).map(([name, value]) => ({ name, value })),
  });
  return {
    name: input.name,
    partitions: created?.partitions ?? input.partitions,
    replicationFactor: created?.replicas ?? input.replicationFactor,
  };
}

export async function deleteLabTopic(port: KafkaPort, name: string) {
  await port.admin.deleteTopics({ topics: [name] });
}

/**
 * Sends with acks=all and answers the first offset written in each partition;
 * 'topic' or 'partition' when the target doesn't exist (the client would
 * otherwise wrap a too-large partition number around).
 */
export async function produce(port: KafkaPort, input: ProduceInput) {
  const topic = knownTopics(await port.metadata()).find((t) => t.name === input.topic);
  if (!topic) return 'topic' as const;
  if (
    input.messages.some((m) => m.partition !== undefined && m.partition >= topic.partitions.length)
  )
    return 'partition' as const;
  const res = await port.producer.send({
    messages: input.messages.map((m) => ({
      topic: input.topic,
      key: m.key ?? undefined,
      value: m.value ?? undefined,
      ...(m.partition === undefined ? {} : { partition: m.partition }),
    })),
  });
  return (res.offsets ?? []).map((o) => ({
    topic: o.topic,
    partition: o.partition,
    offset: num(o.offset),
  }));
}
