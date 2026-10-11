// Story mode for guided scenarios: the simulation stops at every event worth
// explaining, so a reader sees one thing happen at a time with words for it.
// Repeats of the same kind of traffic on the same partition only stop once.
import type { Cluster, ClusterEvent } from '@shiqi/kafka';
import { anchorId } from './anchors';

/** Key of a beat's text in KAFKA_STRINGS.story.beats. */
export type BeatKind =
  | 'produce'
  | 'ackOk'
  | 'ackError'
  | 'replicate'
  | 'hw'
  | 'consume'
  | 'consumeAgain'
  | 'commit'
  | 'isrShrink'
  | 'isrExpand'
  | 'leader'
  | 'leaderUnclean'
  | 'leaderNone'
  | 'truncate'
  | 'truncateLoss'
  | 'brokerDown'
  | 'brokerPowerLoss'
  | 'brokerUp'
  | 'controller'
  | 'brokerSlow'
  | 'brokerFast'
  | 'flush'
  | 'rebalanceStart'
  | 'rebalanceEnd'
  | 'segmentDeleted'
  | 'compacted'
  | 'offsetReset'
  | 'authDenied'
  | 'aclAdd'
  | 'aclRemove'
  | 'authorizerOn'
  | 'authorizerOff';

export interface Beat {
  kind: BeatKind;
  event: ClusterEvent;
  /** On-screen things this beat is about (anchor ids). */
  focus: string[];
}

/** Which text explains this event; null for events a scenario never needs to stop for. */
export function beatKind(e: ClusterEvent): BeatKind | null {
  switch (e.type) {
    case 'produce':
    case 'replicate':
    case 'hw':
    case 'commit':
    case 'isr-shrink':
    case 'isr-expand':
    case 'controller':
    case 'flush':
    case 'rebalance-start':
    case 'rebalance-end':
    case 'segment-deleted':
    case 'compacted':
    case 'offset-reset':
    case 'auth-denied':
      return camel<BeatKind>(e.type);
    case 'ack':
      return e.error ? 'ackError' : 'ackOk';
    case 'consume':
      return e.redelivered > 0 ? 'consumeAgain' : 'consume';
    case 'leader-elected':
      return e.leader === null ? 'leaderNone' : e.unclean ? 'leaderUnclean' : 'leader';
    case 'truncate':
      return e.gone > 0 ? 'truncateLoss' : 'truncate';
    case 'broker-down':
      return e.hard ? 'brokerPowerLoss' : 'brokerDown';
    case 'broker-up':
      return 'brokerUp';
    case 'broker-slow':
      return e.slow ? 'brokerSlow' : 'brokerFast';
    case 'acl':
      return e.change === 'add'
        ? 'aclAdd'
        : e.change === 'remove'
          ? 'aclRemove'
          : e.change === 'on'
            ? 'authorizerOn'
            : 'authorizerOff';
    default:
      return null;
  }
}

const camel = <T extends string>(s: string) =>
  s.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as T;

/** Steady traffic: explained the first time per partition, then let through. */
const REPEATING = new Set<BeatKind>([
  'produce',
  'ackOk',
  'replicate',
  'hw',
  'consume',
  'commit',
  'flush',
]);

/** What makes two repeating events "the same thing again". */
function repeatKey(kind: BeatKind, e: ClusterEvent): string {
  const tp = 'topic' in e && 'partition' in e ? `${e.topic}-${e.partition}` : '';
  // Every broker flushes on its own timer: once is enough to explain it.
  if (e.type === 'flush') return kind;
  const who =
    e.type === 'replicate'
      ? e.to
      : 'group' in e
        ? e.group
        : 'producer' in e
          ? e.producer
          : 'broker' in e
            ? e.broker
            : '';
  return `${kind}:${tp}:${who}`;
}

/**
 * Picks the events to stop at during one scenario step. Feed it every event in
 * order; it returns a beat for the ones worth a pause and counts the rest.
 */
export class BeatFilter {
  private seen = new Set<string>();
  /** Events that went by without a stop, because the same thing was explained already. */
  quiet = 0;

  take(e: ClusterEvent, c: Cluster): Beat | null {
    const kind = beatKind(e);
    if (!kind) return null;
    // Committing offset 0 means "nothing read here yet": nothing to explain.
    if (e.type === 'commit' && e.offset === 0) {
      this.quiet++;
      return null;
    }
    if (REPEATING.has(kind)) {
      const key = repeatKey(kind, e);
      if (this.seen.has(key)) {
        this.quiet++;
        return null;
      }
      this.seen.add(key);
    }
    return { kind, event: e, focus: focusOf(e, c) };
  }
}

/** The cards an event is about, so the stage can point at them. */
export function focusOf(e: ClusterEvent, c: Cluster): string[] {
  const replicas = (topic: string, partition: number) =>
    c.topics
      .get(topic)
      ?.partitions[partition]?.replicas.map((b) => anchorId.replica(topic, partition, b)) ?? [];
  switch (e.type) {
    case 'produce':
      return [anchorId.producer(e.producer), anchorId.replica(e.topic, e.partition, e.broker)];
    case 'ack':
      return [anchorId.producer(e.producer)];
    case 'replicate':
      return [
        anchorId.replica(e.topic, e.partition, e.from),
        anchorId.replica(e.topic, e.partition, e.to),
      ];
    case 'hw':
      return replicas(e.topic, e.partition);
    case 'consume':
      return [anchorId.replica(e.topic, e.partition, e.broker), anchorId.member(e.group, e.member)];
    case 'commit':
    case 'rebalance-start':
    case 'rebalance-end':
    case 'offset-reset':
      return [anchorId.group(e.group)];
    case 'isr-shrink':
    case 'isr-expand':
    case 'truncate':
    case 'segment-deleted':
    case 'compacted':
      return [anchorId.replica(e.topic, e.partition, e.broker)];
    case 'leader-elected':
      return e.leader === null
        ? replicas(e.topic, e.partition)
        : [anchorId.replica(e.topic, e.partition, e.leader)];
    case 'broker-down':
    case 'broker-up':
    case 'broker-slow':
    case 'controller':
    case 'flush':
      return [anchorId.broker(e.broker)];
    case 'auth-denied':
      return [anchorId.producer(e.client), anchorId.group(e.name)];
    default:
      return [];
  }
}

/** Event fields as template values: numbers stay, lists join, the rest become text. */
export const eventVars = (e: object): Record<string, string | number> =>
  Object.fromEntries(
    Object.entries(e).flatMap(([k, v]) =>
      v !== null && typeof v === 'object' && !Array.isArray(v)
        ? Object.entries(v as object).map(([k2, v2]) => [k2, String(v2 ?? '')])
        : [[k, typeof v === 'number' ? v : Array.isArray(v) ? v.join(', ') : String(v ?? '')]],
    ),
  );
