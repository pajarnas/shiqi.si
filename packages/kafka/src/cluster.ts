// A Kafka cluster in memory: brokers, replicated partitions, producers and
// consumer groups, advanced by tick(ms). Every random choice comes from one
// seeded generator, so a seed replays the same story.
import { rng, type Random } from '@shiqi/pixel';
import { ASSIGNORS } from './assignors';
import { CLUSTER_DEFAULTS, TOPIC_DEFAULTS, type ClusterSettings, type TopicConfig } from './config';
import { ReplicaLog } from './log';
import { partitionForKey } from './murmur2';
import {
  KafkaError,
  tpKey,
  type Acks,
  type Assignor,
  type BrokerId,
  type ClusterEvent,
  type GroupState,
  type KRecord,
  type KafkaErrorCode,
  type OffsetReset,
  type TopicPartition,
} from './types';

export interface Broker {
  id: BrokerId;
  rack: string;
  up: boolean;
  /** A slow broker (bad disk, noisy neighbour) fetches far less often and falls out of the ISR. */
  slow: boolean;
  /** Lifetime byte counters. */
  bytesIn: number;
  bytesOut: number;
  /** Smoothed bytes per simulated second. */
  inRate: number;
  outRate: number;
}

interface FollowerState {
  lastCaughtUpAt: number;
  prevFetchAt: number;
  leaderLeoAtPrevFetch: number;
  nextFetchAt: number;
}

export interface Partition {
  topic: string;
  id: number;
  /** Assigned replicas; the first is the preferred leader. */
  replicas: BrokerId[];
  leader: BrokerId | null;
  leaderEpoch: number;
  /** Where each leader epoch started, oldest first. Followers truncate against this. */
  epochStarts: { epoch: number; offset: number }[];
  isr: BrokerId[];
  logs: Map<BrokerId, ReplicaLog>;
  /** Highest offset (exclusive) every ISR replica has: what consumers may read. */
  highWatermark: number;
  followers: Map<BrokerId, FollowerState>;
}

export interface Topic {
  name: string;
  /** 22-character id, like the base64 TopicId Kafka prints. */
  id: string;
  config: TopicConfig;
  partitions: Partition[];
}

export type KeyMode = 'none' | 'fixed' | 'unique';

export interface ProducerOptions {
  id?: string;
  topic: string;
  /** Records per simulated second. */
  rate?: number;
  acks?: Acks;
  /** none = null keys (sticky partitioner), fixed = a few repeating keys, unique = a new key each time. */
  keys?: KeyMode;
  /** Keys used when `keys` is 'fixed'. */
  keySet?: string[];
  /** Records per sticky batch before moving to another partition. */
  batchSize?: number;
}

export interface Producer extends Required<Omit<ProducerOptions, 'id'>> {
  id: string;
  paused: boolean;
  sent: number;
  acked: number;
  failed: number;
  lastError?: KafkaErrorCode;
  credit: number;
  sticky: { partition: number; left: number };
}

export interface ConsumerOptions {
  group: string;
  topics: string[];
  clientId?: string;
  /** Records per simulated second this consumer can process. */
  rate?: number;
  assignor?: Assignor;
  offsetReset?: OffsetReset;
}

export interface Member {
  id: string;
  clientId: string;
  topics: string[];
  assignment: TopicPartition[];
  /** Next offset to read, by `topic-partition`. */
  positions: Map<string, number>;
  /** False after crash(): stops heartbeating but stays until the session times out. */
  alive: boolean;
  lastHeartbeat: number;
  rate: number;
  credit: number;
  consumed: number;
  joinedAt: number;
}

export interface Group {
  id: string;
  assignor: Assignor;
  offsetReset: OffsetReset;
  state: GroupState;
  generation: number;
  members: Map<string, Member>;
  /** Committed offsets by `topic-partition`. */
  committed: Map<string, number>;
  rebalanceAt: number | null;
  autoCommitIntervalMs: number;
  nextCommitAt: number;
}

interface PendingAck {
  producer: string;
  topic: string;
  partition: number;
  offset: number;
  epoch: number;
  at: number;
}

export interface CreateTopicOptions {
  partitions?: number;
  replicationFactor?: number;
  config?: Partial<TopicConfig>;
}

export interface ProduceInput {
  topic: string;
  key?: string | null;
  value: string | null;
  partition?: number;
  acks?: Acks;
  producer?: string;
}

const EVENT_LOG_SIZE = 400;
const MAX_SENDS_PER_TICK = 200;
const MAX_POLL_RECORDS = 500;
const RATE_SMOOTHING = 0.9;

export class Cluster {
  readonly settings: ClusterSettings;
  now = 0;
  /** Bumped on every change; views compare it to know when to redraw. */
  version = 0;
  brokers = new Map<BrokerId, Broker>();
  controller: BrokerId | null = null;
  topics = new Map<string, Topic>();
  producers = new Map<string, Producer>();
  groups = new Map<string, Group>();
  /** The most recent events, oldest first. */
  events: ClusterEvent[] = [];

  private random: Random;
  private pending: PendingAck[] = [];
  private nextCleanAt = 0;
  private counters = { producer: 0, client: 0 };
  private eventListeners = new Set<(e: ClusterEvent) => void>();
  private changeListeners = new Set<() => void>();

  constructor(options: { brokers?: number; racks?: number } & Partial<ClusterSettings> = {}) {
    const { brokers = 3, racks = 0, ...settings } = options;
    this.settings = { ...CLUSTER_DEFAULTS, ...settings };
    this.random = rng(this.settings.seed);
    for (let i = 0; i < brokers; i++) this.addBroker(racks > 0 ? `rack-${(i % racks) + 1}` : '');
  }

  // ── Listeners ────────────────────────────────────────────────────────────

  /** Called for every event as it happens. Returns an unsubscribe function. */
  onEvent(fn: (e: ClusterEvent) => void) {
    this.eventListeners.add(fn);
    return () => void this.eventListeners.delete(fn);
  }

  /** Called after any change (a tick, an admin call). Fits useSyncExternalStore. */
  subscribe = (fn: () => void) => {
    this.changeListeners.add(fn);
    return () => void this.changeListeners.delete(fn);
  };

  getVersion = () => this.version;

  private emit(event: ClusterEvent) {
    this.events.push(event);
    if (this.events.length > EVENT_LOG_SIZE)
      this.events.splice(0, this.events.length - EVENT_LOG_SIZE);
    for (const fn of this.eventListeners) fn(event);
  }

  private changed() {
    this.version++;
    for (const fn of this.changeListeners) fn();
  }

  // ── Brokers ──────────────────────────────────────────────────────────────

  addBroker(rack = ''): Broker {
    const id = Math.max(0, ...this.brokers.keys()) + 1;
    const broker: Broker = {
      id,
      rack,
      up: true,
      slow: false,
      bytesIn: 0,
      bytesOut: 0,
      inRate: 0,
      outRate: 0,
    };
    this.brokers.set(id, broker);
    this.electController();
    this.changed();
    return broker;
  }

  private broker(id: BrokerId): Broker {
    const b = this.brokers.get(id);
    if (!b) throw new KafkaError('BROKER_NOT_AVAILABLE', `Broker ${id} does not exist`);
    return b;
  }

  private isUp = (id: BrokerId) => this.brokers.get(id)?.up === true;

  get liveBrokers(): Broker[] {
    return [...this.brokers.values()].filter((b) => b.up);
  }

  /** Crash a broker: its leaderships move to other ISR members, and it leaves every ISR. */
  stopBroker(id: BrokerId) {
    const b = this.broker(id);
    if (!b.up) return;
    b.up = false;
    b.inRate = 0;
    b.outRate = 0;
    this.emit({ type: 'broker-down', at: this.now, broker: id });
    for (const p of this.allPartitions()) {
      if (!p.replicas.includes(id)) continue;
      // Kafka keeps the last ISR member even when it dies, so it can come back as leader.
      if (p.isr.includes(id) && p.isr.length > 1) {
        p.isr = p.isr.filter((r) => r !== id);
        this.emit({
          type: 'isr-shrink',
          at: this.now,
          topic: p.topic,
          partition: p.id,
          broker: id,
          isr: [...p.isr],
        });
      }
      if (p.leader === id) this.elect(p);
      else this.updateHighWatermark(p);
    }
    this.electController();
    this.changed();
  }

  /** Restart a broker: it truncates any diverged tail, catches up, and rejoins the ISR. */
  startBroker(id: BrokerId) {
    const b = this.broker(id);
    if (b.up) return;
    b.up = true;
    this.emit({ type: 'broker-up', at: this.now, broker: id });
    for (const p of this.allPartitions()) {
      if (!p.replicas.includes(id)) continue;
      const st = p.followers.get(id);
      if (st) Object.assign(st, this.freshFollower());
      if (p.leader === null) this.elect(p);
    }
    this.electController();
    this.changed();
  }

  setBrokerSlow(id: BrokerId, slow: boolean) {
    const b = this.broker(id);
    if (b.slow === slow) return;
    b.slow = slow;
    this.emit({ type: 'broker-slow', at: this.now, broker: id, slow });
    this.changed();
  }

  /** KRaft picks one active controller; here it is the lowest live broker id. */
  private electController() {
    const next = this.liveBrokers.map((b) => b.id).sort((a, b) => a - b)[0] ?? null;
    if (next !== this.controller) {
      this.controller = next;
      if (next !== null) this.emit({ type: 'controller', at: this.now, broker: next });
    }
  }

  // ── Topics ───────────────────────────────────────────────────────────────

  allPartitions(): Partition[] {
    return [...this.topics.values()].flatMap((t) => t.partitions);
  }

  topic(name: string): Topic {
    const t = this.topics.get(name);
    if (!t) {
      throw new KafkaError('UNKNOWN_TOPIC_OR_PARTITION', `Topic '${name}' does not exist`);
    }
    return t;
  }

  partition(topic: string, partition: number): Partition {
    const p = this.topic(topic).partitions[partition];
    if (!p) {
      throw new KafkaError(
        'UNKNOWN_TOPIC_OR_PARTITION',
        `Partition ${topic}-${partition} does not exist`,
      );
    }
    return p;
  }

  createTopic(name: string, options: CreateTopicOptions = {}): Topic {
    const { partitions = 1, replicationFactor = Math.min(3, this.liveBrokers.length) } = options;
    if (!/^[a-zA-Z0-9._-]{1,249}$/.test(name) || name === '.' || name === '..') {
      throw new KafkaError(
        'INVALID_CONFIG',
        `Topic name "${name}" is illegal, it contains a character other than ASCII alphanumerics, '.', '_' and '-'`,
      );
    }
    if (this.topics.has(name)) {
      throw new KafkaError('TOPIC_ALREADY_EXISTS', `Topic '${name}' already exists.`);
    }
    if (partitions < 1) {
      throw new KafkaError('INVALID_PARTITIONS', 'Number of partitions must be larger than 0.');
    }
    if (replicationFactor < 1 || replicationFactor > this.liveBrokers.length) {
      throw new KafkaError(
        'INVALID_REPLICATION_FACTOR',
        `Replication factor: ${replicationFactor} larger than available brokers: ${this.liveBrokers.length}.`,
      );
    }
    const topic: Topic = {
      name,
      id: this.topicId(),
      config: { ...TOPIC_DEFAULTS, ...options.config },
      partitions: [],
    };
    const assignment = this.assignReplicas(partitions, replicationFactor, 0);
    topic.partitions = assignment.map((replicas, id) => this.newPartition(name, id, replicas));
    this.topics.set(name, topic);
    this.emit({ type: 'topic-created', at: this.now, topic: name });
    this.changed();
    return topic;
  }

  deleteTopic(name: string) {
    this.topic(name);
    this.topics.delete(name);
    this.pending = this.pending.filter((a) => a.topic !== name);
    for (const pr of [...this.producers.values()])
      if (pr.topic === name) this.producers.delete(pr.id);
    for (const g of this.groups.values()) {
      for (const k of [...g.committed.keys()])
        if (k.startsWith(`${name}-`) && this.isTpOf(k, name)) g.committed.delete(k);
      if ([...g.members.values()].some((m) => m.topics.includes(name)))
        this.startRebalance(g, 'metadata');
    }
    this.emit({ type: 'topic-deleted', at: this.now, topic: name });
    this.changed();
  }

  private isTpOf(key: string, topic: string) {
    return /^\d+$/.test(key.slice(topic.length + 1));
  }

  /** Partitions can only grow: keyed records would otherwise lose their home. */
  addPartitions(name: string, total: number) {
    const t = this.topic(name);
    const current = t.partitions.length;
    if (total <= current) {
      throw new KafkaError(
        'INVALID_PARTITIONS',
        `Topic currently has ${current} partitions, which is higher than the requested ${total}.`,
      );
    }
    const rf = t.partitions[0]?.replicas.length ?? 1;
    if (rf > this.liveBrokers.length) {
      throw new KafkaError(
        'INVALID_REPLICATION_FACTOR',
        `Replication factor: ${rf} larger than available brokers: ${this.liveBrokers.length}.`,
      );
    }
    const assignment = this.assignReplicas(total - current, rf, current);
    assignment.forEach((replicas, i) =>
      t.partitions.push(this.newPartition(name, current + i, replicas)),
    );
    this.emit({ type: 'partitions-added', at: this.now, topic: name, count: total });
    for (const g of this.groups.values()) {
      if ([...g.members.values()].some((m) => m.topics.includes(name)))
        this.startRebalance(g, 'metadata');
    }
    this.changed();
  }

  setTopicConfig<K extends keyof TopicConfig>(name: string, key: K, value: TopicConfig[K]) {
    const t = this.topic(name);
    t.config[key] = value;
    this.emit({ type: 'config-changed', at: this.now, topic: name, key, value: String(value) });
    this.changed();
  }

  private topicId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = '';
    for (let i = 0; i < 22; i++) id += chars[Math.floor(this.random() * chars.length)];
    return id;
  }

  /**
   * Kafka's rack-unaware replica placement (AdminUtils.assignReplicasToBrokers):
   * leaders go round-robin from a random broker, followers are shifted so the
   * load spreads.
   */
  private assignReplicas(count: number, rf: number, firstPartition: number): BrokerId[][] {
    const ids = this.liveBrokers.map((b) => b.id).sort((a, b) => a - b);
    const n = ids.length;
    const start = Math.floor(this.random() * n);
    let shift = Math.floor(this.random() * n);
    const out: BrokerId[][] = [];
    for (let i = 0; i < count; i++) {
      const p = firstPartition + i;
      if (p > 0 && p % n === 0) shift++;
      const first = (p + start) % n;
      const replicas = [ids[first] as BrokerId];
      for (let j = 0; j < rf - 1; j++) {
        const s = 1 + ((shift + j) % (n - 1));
        replicas.push(ids[(first + s) % n] as BrokerId);
      }
      out.push(replicas);
    }
    return out;
  }

  private newPartition(topic: string, id: number, replicas: BrokerId[]): Partition {
    const leader = replicas[0] ?? null;
    return {
      topic,
      id,
      replicas,
      leader,
      leaderEpoch: 0,
      epochStarts: [{ epoch: 0, offset: 0 }],
      isr: [...replicas],
      logs: new Map(replicas.map((r) => [r, new ReplicaLog(() => this.now)])),
      highWatermark: 0,
      followers: new Map(
        replicas.filter((r) => r !== leader).map((r) => [r, this.freshFollower()]),
      ),
    };
  }

  private freshFollower(): FollowerState {
    return {
      lastCaughtUpAt: this.now,
      prevFetchAt: this.now,
      leaderLeoAtPrevFetch: 0,
      nextFetchAt: this.now,
    };
  }

  leaderLog(p: Partition): ReplicaLog | undefined {
    return p.leader === null ? undefined : p.logs.get(p.leader);
  }

  // ── Leadership ───────────────────────────────────────────────────────────

  /**
   * Pick a new leader: the first assigned replica that is alive and in the
   * ISR. With none, the partition goes offline unless unclean election is on,
   * which takes any live replica and may lose acknowledged writes.
   */
  private elect(p: Partition, preferred?: BrokerId) {
    const topic = this.topic(p.topic);
    let leader =
      preferred ??
      p.replicas.find((r) => r !== p.leader && this.isUp(r) && p.isr.includes(r)) ??
      null;
    let unclean = false;
    if (leader === null && topic.config['unclean.leader.election.enable']) {
      leader = p.replicas.find((r) => this.isUp(r)) ?? null;
      unclean = leader !== null;
    }
    if (leader === null) {
      if (p.leader !== null) {
        p.leader = null;
        this.emit({
          type: 'leader-elected',
          at: this.now,
          topic: p.topic,
          partition: p.id,
          leader: null,
          epoch: p.leaderEpoch,
          unclean: false,
        });
      }
      return;
    }
    p.leader = leader;
    p.leaderEpoch++;
    const log = p.logs.get(leader) as ReplicaLog;
    p.epochStarts.push({ epoch: p.leaderEpoch, offset: log.logEndOffset });
    p.isr = unclean ? [leader] : p.isr.filter((r) => this.isUp(r));
    if (!p.isr.includes(leader)) p.isr.unshift(leader);
    p.followers = new Map(
      p.replicas.filter((r) => r !== leader).map((r) => [r, this.freshFollower()]),
    );
    this.emit({
      type: 'leader-elected',
      at: this.now,
      topic: p.topic,
      partition: p.id,
      leader,
      epoch: p.leaderEpoch,
      unclean,
    });
    if (unclean) p.highWatermark = Math.min(p.highWatermark, log.logEndOffset);
    // Writes the new leader never got are gone; their producers hear about it.
    for (const a of this.pending) {
      if (a.topic === p.topic && a.partition === p.id && a.offset >= log.logEndOffset) {
        this.failAck(a, 'NOT_LEADER_OR_FOLLOWER');
      }
    }
    this.pending = this.pending.filter(
      (a) => !(a.topic === p.topic && a.partition === p.id && a.offset >= log.logEndOffset),
    );
    this.updateHighWatermark(p);
  }

  /** Move leadership back to each partition's first replica where it can take it. */
  preferredElection(topic?: string, partition?: number): number {
    let moved = 0;
    for (const p of this.allPartitions()) {
      if (topic !== undefined && p.topic !== topic) continue;
      if (partition !== undefined && p.id !== partition) continue;
      const pref = p.replicas[0];
      if (pref === undefined || p.leader === pref || !this.isUp(pref) || !p.isr.includes(pref))
        continue;
      this.elect(p, pref);
      moved++;
    }
    if (moved) this.changed();
    return moved;
  }

  /** Offset where `epoch` ended: the start of the next epoch, or the leader's LEO. */
  private endOffsetForEpoch(p: Partition, epoch: number): number {
    const next = p.epochStarts.find((e) => e.epoch > epoch);
    return next ? next.offset : (this.leaderLog(p)?.logEndOffset ?? 0);
  }

  private updateHighWatermark(p: Partition) {
    const leader = this.leaderLog(p);
    if (!leader) return;
    const leos = p.isr.filter((r) => this.isUp(r)).map((r) => p.logs.get(r)?.logEndOffset ?? 0);
    const hw = Math.min(leader.logEndOffset, ...leos);
    if (hw > p.highWatermark) p.highWatermark = hw;
  }

  // ── Producing ────────────────────────────────────────────────────────────

  /**
   * Append one record to a partition leader. Returns where it went; with
   * acks=all the 'ack' event comes later, once the ISR has it.
   */
  produce(input: ProduceInput): { partition: number; offset: number } {
    const t = this.topic(input.topic);
    const key = input.key ?? null;
    const acks = input.acks ?? 'all';
    const producer = input.producer ?? 'cli';
    if (t.config['cleanup.policy'] === 'compact' && key === null) {
      throw new KafkaError('INVALID_RECORD', 'Compacted topic cannot accept message without key.');
    }
    const partition =
      input.partition ??
      (key === null ? this.anyPartition(t) : partitionForKey(key, t.partitions.length));
    const p = this.partition(t.name, partition);
    if (p.leader === null) {
      throw new KafkaError('LEADER_NOT_AVAILABLE', `There is no leader for ${t.name}-${partition}`);
    }
    if (acks === 'all' && p.isr.length < t.config['min.insync.replicas']) {
      throw new KafkaError(
        'NOT_ENOUGH_REPLICAS',
        `The size of the current ISR [${p.isr.join(', ')}] is insufficient to satisfy the min.isr requirement of ${t.config['min.insync.replicas']} for partition ${t.name}-${partition}`,
      );
    }
    const log = this.leaderLog(p) as ReplicaLog;
    const record: KRecord = {
      offset: log.logEndOffset,
      key,
      value: input.value,
      timestamp: this.now,
      size: this.settings.recordOverhead + (key?.length ?? 0) + (input.value?.length ?? 0),
      leaderEpoch: p.leaderEpoch,
      producer,
    };
    log.append(record, t.config['segment.bytes']);
    this.broker(p.leader).bytesIn += record.size;
    this.emit({
      type: 'produce',
      at: this.now,
      producer,
      topic: t.name,
      partition,
      broker: p.leader,
      offset: record.offset,
      key,
    });
    if (acks === 'all') {
      this.pending.push({
        producer,
        topic: t.name,
        partition,
        offset: record.offset,
        epoch: p.leaderEpoch,
        at: this.now,
      });
    } else {
      this.emit({
        type: 'ack',
        at: this.now,
        producer,
        topic: t.name,
        partition,
        offset: record.offset,
      });
      this.countAck(producer);
    }
    this.updateHighWatermark(p);
    this.changed();
    return { partition, offset: record.offset };
  }

  /** A partition with a leader, for null-keyed records without a sticky producer. */
  private anyPartition(t: Topic): number {
    const ok = t.partitions.filter((p) => p.leader !== null);
    const list = ok.length ? ok : t.partitions;
    return list[Math.floor(this.random() * list.length)]?.id ?? 0;
  }

  addProducer(options: ProducerOptions): Producer {
    this.topic(options.topic);
    const id = options.id ?? `producer-${++this.counters.producer}`;
    const producer: Producer = {
      id,
      topic: options.topic,
      rate: options.rate ?? 4,
      acks: options.acks ?? 'all',
      keys: options.keys ?? 'none',
      keySet: options.keySet ?? ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'],
      batchSize: options.batchSize ?? 8,
      paused: false,
      sent: 0,
      acked: 0,
      failed: 0,
      credit: 0,
      sticky: { partition: -1, left: 0 },
    };
    this.producers.set(id, producer);
    this.changed();
    return producer;
  }

  updateProducer(id: string, patch: Partial<Pick<Producer, 'rate' | 'acks' | 'keys' | 'paused'>>) {
    const pr = this.producers.get(id);
    if (!pr) return;
    Object.assign(pr, patch);
    this.changed();
  }

  removeProducer(id: string) {
    this.producers.delete(id);
    this.pending = this.pending.filter((a) => a.producer !== id);
    this.changed();
  }

  private sendFrom(pr: Producer) {
    const t = this.topics.get(pr.topic);
    if (!t) return;
    const n = pr.sent;
    const key =
      pr.keys === 'fixed'
        ? (pr.keySet[Math.floor(this.random() * pr.keySet.length)] ?? null)
        : pr.keys === 'unique'
          ? `${pr.id}-${n}`
          : null;
    let partition: number | undefined;
    if (key === null) {
      // Sticky partitioner: fill a batch on one available partition, then move on.
      const current = t.partitions[pr.sticky.partition];
      if (pr.sticky.left <= 0 || !current || current.leader === null) {
        pr.sticky = { partition: this.anyPartition(t), left: pr.batchSize };
      }
      partition = pr.sticky.partition;
      pr.sticky.left--;
    }
    pr.sent++;
    try {
      this.produce({
        topic: t.name,
        key,
        value:
          t.config['cleanup.policy'] === 'compact' && this.random() < 0.05 ? null : `{"n":${n}}`,
        partition,
        acks: pr.acks,
        producer: pr.id,
      });
    } catch (e) {
      const code = e instanceof KafkaError ? e.code : 'INVALID_RECORD';
      pr.failed++;
      pr.lastError = code;
      this.emit({
        type: 'ack',
        at: this.now,
        producer: pr.id,
        topic: t.name,
        partition: partition ?? -1,
        offset: -1,
        error: code,
      });
    }
  }

  private countAck(producer: string) {
    const pr = this.producers.get(producer);
    if (pr) pr.acked++;
  }

  private failAck(a: PendingAck, error: KafkaErrorCode) {
    const pr = this.producers.get(a.producer);
    if (pr) {
      pr.failed++;
      pr.lastError = error;
    }
    this.emit({
      type: 'ack',
      at: this.now,
      producer: a.producer,
      topic: a.topic,
      partition: a.partition,
      offset: a.offset,
      error,
    });
  }

  // ── Consumer groups ──────────────────────────────────────────────────────

  group(id: string): Group {
    const g = this.groups.get(id);
    if (!g) throw new KafkaError('GROUP_ID_NOT_FOUND', `Consumer group '${id}' does not exist.`);
    return g;
  }

  private ensureGroup(id: string, assignor: Assignor, offsetReset: OffsetReset): Group {
    let g = this.groups.get(id);
    if (!g) {
      g = {
        id,
        assignor,
        offsetReset,
        state: 'Empty',
        generation: 0,
        members: new Map(),
        committed: new Map(),
        rebalanceAt: null,
        autoCommitIntervalMs: 1000,
        nextCommitAt: this.now + 1000,
      };
      this.groups.set(id, g);
    }
    return g;
  }

  /** A new consumer joins its group, which triggers a rebalance. Returns the member id. */
  addConsumer(options: ConsumerOptions): Member {
    for (const t of options.topics) this.topic(t);
    const g = this.ensureGroup(
      options.group,
      options.assignor ?? 'range',
      options.offsetReset ?? 'latest',
    );
    const clientId = options.clientId ?? `consumer-${options.group}-${++this.counters.client}`;
    const suffix = Math.floor(this.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    const member: Member = {
      id: `${clientId}-${suffix}`,
      clientId,
      topics: [...options.topics],
      assignment: [],
      positions: new Map(),
      alive: true,
      lastHeartbeat: this.now,
      rate: options.rate ?? 6,
      credit: 0,
      consumed: 0,
      joinedAt: this.now,
    };
    g.members.set(member.id, member);
    this.startRebalance(g, 'join');
    this.changed();
    return member;
  }

  /** Graceful close: commit, send LeaveGroup, rebalance right away. */
  removeConsumer(group: string, memberId: string) {
    const g = this.group(group);
    const m = g.members.get(memberId);
    if (!m) return;
    this.commitMember(g, m);
    g.members.delete(memberId);
    this.startRebalance(g, 'leave');
    this.changed();
  }

  /** Crash: no commit, no LeaveGroup. Its partitions stall until session.timeout.ms. */
  crashConsumer(group: string, memberId: string) {
    const m = this.group(group).members.get(memberId);
    if (!m) return;
    m.alive = false;
    this.changed();
  }

  updateConsumer(group: string, memberId: string, patch: Partial<Pick<Member, 'rate'>>) {
    const m = this.group(group).members.get(memberId);
    if (!m) return;
    Object.assign(m, patch);
    this.changed();
  }

  deleteGroup(id: string) {
    const g = this.group(id);
    if (g.members.size > 0) {
      throw new KafkaError(
        'NON_EMPTY_GROUP',
        `Deletion of group ${id} failed: The group is not empty.`,
      );
    }
    this.groups.delete(id);
    this.changed();
  }

  private isCooperative = (g: Group) => g.assignor === 'cooperative-sticky';

  private startRebalance(g: Group, reason: 'join' | 'leave' | 'timeout' | 'metadata') {
    if (g.state !== 'PreparingRebalance') {
      this.emit({
        type: 'rebalance-start',
        at: this.now,
        group: g.id,
        generation: g.generation,
        reason,
      });
    }
    g.state = 'PreparingRebalance';
    g.rebalanceAt = this.now + this.settings.rebalanceDelayMs;
    // Eager protocols revoke everything up front: the whole group stops.
    if (!this.isCooperative(g)) {
      for (const m of g.members.values()) {
        this.commitMember(g, m);
        m.assignment = [];
        m.positions.clear();
      }
    }
  }

  private finishRebalance(g: Group) {
    const members = new Map([...g.members.values()].map((m) => [m.id, m.topics] as const));
    const partitions = new Map(
      [...new Set([...members.values()].flat())]
        .filter((t) => this.topics.has(t))
        .map((t) => [t, this.topic(t).partitions.length] as const),
    );
    const previous = new Map([...g.members.values()].map((m) => [m.id, m.assignment] as const));
    const result = ASSIGNORS[g.assignor]({ members, partitions, previous });
    for (const m of g.members.values()) {
      const next = result.get(m.id) ?? [];
      const keep = new Set(next.map((tp) => tpKey(tp.topic, tp.partition)));
      for (const tp of m.assignment) {
        const k = tpKey(tp.topic, tp.partition);
        if (!keep.has(k)) {
          this.commitOne(g, tp, m.positions.get(k));
          m.positions.delete(k);
        }
      }
      m.assignment = next;
    }
    g.generation++;
    g.rebalanceAt = null;
    g.state = g.members.size ? 'Stable' : 'Empty';
    this.emit({
      type: 'rebalance-end',
      at: this.now,
      group: g.id,
      generation: g.generation,
      members: g.members.size,
    });
  }

  private commitOne(g: Group, tp: TopicPartition, offset: number | undefined) {
    if (offset === undefined) return;
    const k = tpKey(tp.topic, tp.partition);
    if (g.committed.get(k) === offset) return;
    g.committed.set(k, offset);
    this.emit({
      type: 'commit',
      at: this.now,
      group: g.id,
      topic: tp.topic,
      partition: tp.partition,
      offset,
    });
  }

  private commitMember(g: Group, m: Member) {
    for (const tp of m.assignment)
      this.commitOne(g, tp, m.positions.get(tpKey(tp.topic, tp.partition)));
  }

  /** Where a member starts reading: the committed offset, else auto.offset.reset. */
  private startPosition(g: Group, p: Partition): number {
    const committed = g.committed.get(tpKey(p.topic, p.id));
    const log = this.leaderLog(p);
    const start = log?.logStartOffset ?? 0;
    if (committed !== undefined && committed >= start) return committed;
    const to = g.offsetReset === 'earliest' ? start : p.highWatermark;
    if (committed !== undefined) {
      this.emit({
        type: 'offset-reset',
        at: this.now,
        group: g.id,
        topic: p.topic,
        partition: p.id,
        to,
      });
    }
    return to;
  }

  /** kafka-consumer-groups --reset-offsets. Only allowed while the group has no members. */
  resetOffsets(
    group: string,
    topic: string,
    spec: { to: 'earliest' | 'latest' } | { offset: number } | { shiftBy: number },
    partitions?: number[],
  ): { topic: string; partition: number; offset: number }[] {
    const g = this.group(group);
    if (g.members.size > 0) {
      throw new KafkaError(
        'NON_EMPTY_GROUP',
        `Assignments can only be reset if the group '${group}' is inactive, but the current state is ${g.state}.`,
      );
    }
    const t = this.topic(topic);
    const out: { topic: string; partition: number; offset: number }[] = [];
    for (const p of t.partitions) {
      if (partitions && !partitions.includes(p.id)) continue;
      const log = this.leaderLog(p);
      const start = log?.logStartOffset ?? 0;
      const end = p.highWatermark;
      const current = g.committed.get(tpKey(topic, p.id)) ?? end;
      const raw =
        'to' in spec
          ? spec.to === 'earliest'
            ? start
            : end
          : 'offset' in spec
            ? spec.offset
            : current + spec.shiftBy;
      out.push({ topic, partition: p.id, offset: Math.max(start, Math.min(end, raw)) });
    }
    return out;
  }

  /** Apply the result of resetOffsets (the --execute step). */
  commitOffsets(group: string, offsets: { topic: string; partition: number; offset: number }[]) {
    const g = this.ensureGroup(group, 'range', 'latest');
    for (const o of offsets) this.commitOne(g, o, o.offset);
    this.changed();
  }

  /** Per-partition progress of a group, like kafka-consumer-groups --describe. */
  describeGroup(id: string) {
    const g = this.group(id);
    const owner = new Map<string, Member>();
    for (const m of g.members.values())
      for (const tp of m.assignment) owner.set(tpKey(tp.topic, tp.partition), m);
    const topics = new Set<string>([
      ...[...g.members.values()].flatMap((m) => m.topics),
      ...[...g.committed.keys()].flatMap((k) =>
        [...this.topics.keys()].filter((t) => k.startsWith(`${t}-`) && this.isTpOf(k, t)),
      ),
    ]);
    const rows = [...topics]
      .filter((t) => this.topics.has(t))
      .sort()
      .flatMap((t) =>
        this.topic(t).partitions.map((p) => {
          const k = tpKey(t, p.id);
          const committed = g.committed.get(k);
          const m = owner.get(k);
          return {
            topic: t,
            partition: p.id,
            currentOffset: committed,
            logEndOffset: p.highWatermark,
            lag: committed === undefined ? undefined : Math.max(0, p.highWatermark - committed),
            position: m?.positions.get(k),
            member: m,
          };
        }),
      );
    return { group: g, rows };
  }

  // ── Time ─────────────────────────────────────────────────────────────────

  /** Advance the simulation by `ms` of simulated time. */
  tick(ms: number) {
    if (ms <= 0) return;
    this.now += ms;
    const before = new Map(
      [...this.brokers.values()].map((b) => [b.id, [b.bytesIn, b.bytesOut] as const]),
    );

    for (const pr of this.producers.values()) {
      if (pr.paused) continue;
      pr.credit += (pr.rate * ms) / 1000;
      let n = Math.min(Math.floor(pr.credit), MAX_SENDS_PER_TICK);
      pr.credit -= Math.floor(pr.credit);
      while (n-- > 0) this.sendFrom(pr);
    }

    for (const p of this.allPartitions()) this.replicate(p);
    this.resolveAcks();
    this.runGroups(ms);
    if (this.now >= this.nextCleanAt) {
      this.nextCleanAt = this.now + this.settings.logCleanerIntervalMs;
      this.cleanLogs();
    }

    for (const b of this.brokers.values()) {
      const [bin = 0, bout = 0] = before.get(b.id) ?? [];
      const k = 1000 / ms;
      b.inRate = b.inRate * RATE_SMOOTHING + (b.bytesIn - bin) * k * (1 - RATE_SMOOTHING);
      b.outRate = b.outRate * RATE_SMOOTHING + (b.bytesOut - bout) * k * (1 - RATE_SMOOTHING);
    }
    this.changed();
  }

  /** Followers fetch from the leader; the ISR shrinks and grows; the HW moves. */
  private replicate(p: Partition) {
    const leaderId = p.leader;
    if (leaderId === null || !this.isUp(leaderId)) return;
    const leader = p.logs.get(leaderId) as ReplicaLog;
    const segmentBytes = this.topic(p.topic).config['segment.bytes'];

    for (const [id, st] of p.followers) {
      const b = this.brokers.get(id);
      if (!b?.up || this.now < st.nextFetchAt) continue;
      st.nextFetchAt =
        this.now + this.settings.replicaFetchIntervalMs * (b.slow ? this.settings.slowFactor : 1);
      const log = p.logs.get(id) as ReplicaLog;

      // A follower whose log ran ahead in an older epoch drops the diverged tail.
      if (log.lastEpoch >= 0 && log.lastEpoch < p.leaderEpoch) {
        const end = this.endOffsetForEpoch(p, log.lastEpoch);
        if (log.logEndOffset > end) {
          const lost = log.truncateTo(end);
          this.emit({
            type: 'truncate',
            at: this.now,
            topic: p.topic,
            partition: p.id,
            broker: id,
            to: end,
            lost,
          });
        }
      }
      if (log.logEndOffset < leader.logStartOffset) log.resetTo(leader.logStartOffset);

      const from = log.logEndOffset;
      const batch = leader.read(from, leader.logEndOffset, this.settings.replicaFetchMaxRecords);
      for (const r of batch) log.append(r, segmentBytes);
      // Nothing left in range (compacted away): jump straight to the leader's end.
      if (batch.length === 0) log.advanceTo(leader.logEndOffset);
      if (batch.length > 0) {
        const bytes = batch.reduce((s, r) => s + r.size, 0);
        this.broker(leaderId).bytesOut += bytes;
        b.bytesIn += bytes;
        this.emit({
          type: 'replicate',
          at: this.now,
          topic: p.topic,
          partition: p.id,
          from: leaderId,
          to: id,
          fromOffset: from,
          count: batch.length,
        });
      }

      if (log.logEndOffset >= leader.logEndOffset) st.lastCaughtUpAt = this.now;
      else if (log.logEndOffset >= st.leaderLeoAtPrevFetch) st.lastCaughtUpAt = st.prevFetchAt;
      st.prevFetchAt = this.now;
      st.leaderLeoAtPrevFetch = leader.logEndOffset;

      // Back in the ISR once it has the HW and everything from the current epoch's start.
      const epochStart = p.epochStarts[p.epochStarts.length - 1]?.offset ?? 0;
      if (!p.isr.includes(id) && log.logEndOffset >= Math.max(p.highWatermark, epochStart)) {
        p.isr = [...p.isr, id].sort((a, c) => p.replicas.indexOf(a) - p.replicas.indexOf(c));
        this.emit({
          type: 'isr-expand',
          at: this.now,
          topic: p.topic,
          partition: p.id,
          broker: id,
          isr: [...p.isr],
        });
      }
    }

    for (const id of [...p.isr]) {
      if (id === leaderId) continue;
      const st = p.followers.get(id);
      if (st && this.now - st.lastCaughtUpAt > this.settings.replicaLagTimeMaxMs) {
        p.isr = p.isr.filter((r) => r !== id);
        this.emit({
          type: 'isr-shrink',
          at: this.now,
          topic: p.topic,
          partition: p.id,
          broker: id,
          isr: [...p.isr],
        });
      }
    }
    this.updateHighWatermark(p);
  }

  private resolveAcks() {
    const still: PendingAck[] = [];
    for (const a of this.pending) {
      const p = this.topics.get(a.topic)?.partitions[a.partition];
      if (!p) continue;
      if (a.offset < p.highWatermark) {
        this.emit({
          type: 'ack',
          at: this.now,
          producer: a.producer,
          topic: a.topic,
          partition: a.partition,
          offset: a.offset,
        });
        this.countAck(a.producer);
      } else if (this.now - a.at > this.settings.requestTimeoutMs) {
        this.failAck(a, 'REQUEST_TIMED_OUT');
      } else {
        still.push(a);
      }
    }
    this.pending = still;
  }

  private runGroups(ms: number) {
    for (const g of this.groups.values()) {
      for (const m of g.members.values()) {
        if (m.alive) m.lastHeartbeat = this.now;
        else if (this.now - m.lastHeartbeat > this.settings.sessionTimeoutMs) {
          g.members.delete(m.id);
          this.startRebalance(g, 'timeout');
        }
      }
      if (g.state === 'PreparingRebalance' && g.rebalanceAt !== null && this.now >= g.rebalanceAt) {
        this.finishRebalance(g);
      }
      const paused = g.state === 'PreparingRebalance' && !this.isCooperative(g);
      if (paused) continue;

      for (const m of g.members.values()) {
        if (!m.alive) continue;
        m.credit = Math.min(MAX_POLL_RECORDS, m.credit + (m.rate * ms) / 1000);
        // Rotate where each poll starts so one busy partition can't starve the rest.
        const order = [...m.assignment];
        const shift = order.length ? m.consumed % order.length : 0;
        for (const tp of [...order.slice(shift), ...order.slice(0, shift)]) {
          if (m.credit < 1) break;
          this.pollPartition(g, m, tp);
        }
      }

      if (this.now >= g.nextCommitAt) {
        g.nextCommitAt = this.now + g.autoCommitIntervalMs;
        for (const m of g.members.values()) if (m.alive) this.commitMember(g, m);
      }
    }
  }

  private pollPartition(g: Group, m: Member, tp: TopicPartition) {
    const p = this.topics.get(tp.topic)?.partitions[tp.partition];
    if (!p || p.leader === null) return;
    const log = this.leaderLog(p) as ReplicaLog;
    const k = tpKey(tp.topic, tp.partition);
    let pos = m.positions.get(k) ?? this.startPosition(g, p);
    if (pos < log.logStartOffset || pos > log.logEndOffset) {
      // OFFSET_OUT_OF_RANGE: retention deleted it, or an unclean election cut the log short.
      pos = g.offsetReset === 'earliest' ? log.logStartOffset : p.highWatermark;
      this.emit({
        type: 'offset-reset',
        at: this.now,
        group: g.id,
        topic: tp.topic,
        partition: tp.partition,
        to: pos,
      });
    }
    const batch = log.read(pos, p.highWatermark, Math.floor(m.credit));
    if (batch.length > 0) {
      const last = batch[batch.length - 1] as KRecord;
      const bytes = batch.reduce((s, r) => s + r.size, 0);
      this.broker(p.leader).bytesOut += bytes;
      this.emit({
        type: 'consume',
        at: this.now,
        group: g.id,
        member: m.id,
        topic: tp.topic,
        partition: tp.partition,
        broker: p.leader,
        fromOffset: pos,
        count: batch.length,
      });
      m.credit -= batch.length;
      m.consumed += batch.length;
      pos = last.offset + 1;
    } else if (pos < p.highWatermark) {
      pos = p.highWatermark; // Everything in between was compacted away.
    }
    m.positions.set(k, pos);
  }

  private cleanLogs() {
    for (const t of this.topics.values()) {
      for (const p of t.partitions) {
        for (const [id, log] of p.logs) {
          if (!this.isUp(id)) continue;
          const limit = Math.min(p.highWatermark, log.logEndOffset);
          if (t.config['cleanup.policy'] === 'compact') {
            const removed = log.compact(
              Math.min(limit, log.active.baseOffset),
              t.config['delete.retention.ms'],
            );
            if (removed)
              this.emit({
                type: 'compacted',
                at: this.now,
                topic: t.name,
                partition: p.id,
                broker: id,
                removed,
              });
          } else {
            for (const seg of log.applyRetention(
              t.config['retention.ms'],
              t.config['retention.bytes'],
              limit,
            )) {
              this.emit({
                type: 'segment-deleted',
                at: this.now,
                topic: t.name,
                partition: p.id,
                broker: id,
                baseOffset: seg.baseOffset,
                count: seg.records.length,
              });
            }
          }
        }
      }
    }
  }
}
