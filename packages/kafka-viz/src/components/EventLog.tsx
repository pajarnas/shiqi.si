import type { Cluster, ClusterEvent } from '@shiqi/kafka';
import { EventList } from '@shiqi/lab';
import { eventVars } from '../story';
import { format, useKafkaStrings, type KafkaStrings } from '../strings';

/** Per-record events: there are many, so they are hidden unless asked for. */
const DATA_EVENTS = new Set<ClusterEvent['type']>([
  'produce',
  'replicate',
  'consume',
  'commit',
  'hw',
  'flush',
]);

/** One event as a sentence. */
export function describeEvent(e: ClusterEvent, t: KafkaStrings['events']): string {
  const v = eventVars(e);
  switch (e.type) {
    case 'produce':
      return format(t.produce, v);
    case 'ack':
      return format(e.error ? t.ackError : t.ackOk, v);
    case 'replicate':
      return format(t.replicate, v);
    case 'consume':
      return format(t.consume, v);
    case 'commit':
      return format(t.commit, v);
    case 'hw':
      return format(t.hw, v);
    case 'isr-shrink':
      return format(t.isrShrink, v);
    case 'isr-expand':
      return format(t.isrExpand, v);
    case 'leader-elected':
      return format(e.leader === null ? t.leaderNone : e.unclean ? t.leaderUnclean : t.leader, v);
    case 'truncate': {
      const text = format(t.truncate, { ...v, reason: t.truncateReasons[e.reason] });
      return e.gone > 0 ? `${text}. ${format(t.truncateGone, v)}` : text;
    }
    case 'broker-down':
      return format(e.hard ? t.brokerPowerLoss : t.brokerDown, v);
    case 'flush':
      return format(t.flush, v);
    case 'broker-up':
      return format(t.brokerUp, v);
    case 'controller':
      return format(t.controller, v);
    case 'broker-slow':
      return format(e.slow ? t.brokerSlow : t.brokerFast, v);
    case 'rebalance-start':
      return format(t.rebalanceStart, { ...v, reason: t.reasons[e.reason] });
    case 'rebalance-end':
      return format(t.rebalanceEnd, v);
    case 'segment-deleted':
      return format(t.segmentDeleted, v);
    case 'compacted':
      return format(t.compacted, v);
    case 'offset-reset':
      return format(t.offsetReset, v);
    case 'topic-created':
      return format(t.topicCreated, v);
    case 'topic-deleted':
      return format(t.topicDeleted, v);
    case 'partitions-added':
      return format(t.partitionsAdded, v);
    case 'config-changed':
      return format(t.configChanged, v);
    case 'auth-denied':
      return format(t.authDenied, v);
    case 'acl':
      if (e.change === 'on') return t.authorizerOn;
      if (e.change === 'off') return t.authorizerOff;
      return format(e.change === 'add' ? t.aclAdd : t.aclRemove, v);
  }
}

const tone = (e: ClusterEvent) =>
  (e.type === 'ack' && e.error) ||
  e.type === 'broker-down' ||
  e.type === 'truncate' ||
  e.type === 'isr-shrink' ||
  e.type === 'auth-denied' ||
  (e.type === 'leader-elected' && (e.leader === null || e.unclean))
    ? 'bad'
    : e.type === 'isr-expand' || e.type === 'broker-up' || e.type === 'rebalance-end'
      ? 'good'
      : undefined;

const isData = (e: ClusterEvent) => DATA_EVENTS.has(e.type) || (e.type === 'ack' && !e.error);

export function EventLog({ cluster }: { cluster: Cluster }) {
  const t = useKafkaStrings();
  return (
    <EventList
      strings={t.events}
      events={cluster.events}
      isData={isData}
      describe={(e) => describeEvent(e, t.events)}
      tone={tone}
    />
  );
}
