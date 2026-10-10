// Every word @shiqi/kafka-viz shows. English is the default; apps pass their
// own translation through <KafkaStringsProvider> (the site keeps zh in its
// i18n/strings and lets the translation service fill the rest).
import { format } from '@shiqi/ui';
import { createContext, useContext, type ReactNode } from 'react';

export const KAFKA_STRINGS = {
  toolbar: {
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    speed: 'Simulation speed',
    reset: 'Reset',
    clock: 'Simulated time {time}',
  },
  lanes: {
    producers: 'Producers',
    cluster: 'Cluster',
    consumers: 'Consumer groups',
    noProducers: 'No producers. Add one below, or type kafka-console-producer in the terminal.',
    noGroups: 'No consumer groups yet.',
  },
  broker: {
    title: 'Broker {id}',
    controller: 'Controller',
    up: 'Running',
    down: 'Stopped',
    slow: 'Slow disk',
    netIn: 'In',
    netOut: 'Out',
    disk: 'Disk',
    stop: 'Stop',
    start: 'Start',
    makeSlow: 'Slow down',
    makeFast: 'Speed up',
    leader: 'Leader',
    follower: 'Follower',
    outOfSync: 'Out of sync',
    offline: 'Offline',
    replica: '{topic} partition {partition}: {role}, log end offset {leo}, high watermark {hw}',
    empty: 'No replicas on this broker.',
  },
  producer: {
    title: '{id}',
    rate: '{rate}/s',
    acks: 'acks={acks}',
    keys: {
      none: 'No keys (sticky)',
      fixed: 'A few keys',
      unique: 'Unique keys',
    },
    stats: 'sent {sent} · acked {acked} · failed {failed}',
    lastError: 'Last error: {error}',
    pause: 'Pause',
    resume: 'Resume',
    remove: 'Remove',
  },
  group: {
    state: {
      Empty: 'Empty',
      PreparingRebalance: 'Rebalancing',
      CompletingRebalance: 'Syncing',
      Stable: 'Stable',
      Dead: 'Dead',
    },
    generation: 'gen {n}',
    lag: 'lag {n}',
    totalLag: 'Total lag {n}',
    noPartitions: 'No partitions (more members than partitions, or rebalancing)',
    crashed: 'Crashed: removed after the session timeout',
    leave: 'Leave',
    crash: 'Crash',
    rate: '{rate}/s',
  },
  panels: {
    label: 'Panels',
    inspect: 'Inspect',
    topics: 'Topics',
    produce: 'Producers',
    consume: 'Consumers',
    terminal: 'Terminal',
    events: 'Events',
  },
  inspect: {
    pick: 'Click a partition row in any broker to look inside it.',
    title: '{topic} · partition {partition}',
    leader: 'Leader',
    epoch: 'Leader epoch',
    replicas: 'Replicas',
    isr: 'In-sync replicas',
    hw: 'High watermark',
    leo: 'Log end offset',
    start: 'Log start offset',
    none: 'none',
    segments: 'Segment files on broker {id}',
    bytes: '{n} B',
    records: '{n} records',
    committed: 'Committed by {group}',
    legendHw: 'HW: consumers read below this line',
    legendLeo: 'LEO: next offset to write',
    tombstone: 'tombstone',
    hidden: '{n} older records not drawn',
  },
  topics: {
    create: 'Create topic',
    name: 'Name',
    partitions: 'Partitions',
    replication: 'Replication factor',
    policy: 'Cleanup policy',
    minIsr: 'min.insync.replicas',
    delete: 'Delete',
    addPartition: '+1 partition',
    summary: '{partitions} partitions · RF {rf} · {policy}',
    created: 'Created topic {name}.',
  },
  produce: {
    add: 'Add producer',
    topic: 'Topic',
    rate: 'Records per second',
    acks: 'acks',
    keys: 'Keys',
  },
  consume: {
    add: 'Add consumer',
    group: 'Group id',
    topic: 'Topic',
    assignor: 'Assignment strategy',
    reset: 'auto.offset.reset',
    rate: 'Processing speed (records/s)',
  },
  terminal: {
    label: 'Kafka terminal',
    welcome: 'Simulated cluster ready. Type help for commands, or try: kafka-topics --describe',
    input: 'Command',
    stop: 'Ctrl-C',
  },
  events: {
    empty: 'Nothing has happened yet.',
    showData: 'Show every record (produce, replicate, consume, commit)',
    produce: '{producer} wrote offset {offset} to {topic}-{partition} on broker {broker}',
    ackOk: '{producer} got an ack for {topic}-{partition} offset {offset}',
    ackError: '{producer}: {error} on {topic}-{partition}',
    replicate: 'Broker {to} copied {count} records of {topic}-{partition} from leader {from}',
    consume: '{member} read {count} records from {topic}-{partition}',
    commit: '{group} committed {topic}-{partition} at offset {offset}',
    isrShrink: 'Broker {broker} fell out of the ISR of {topic}-{partition}: ISR is now [{isr}]',
    isrExpand: 'Broker {broker} caught up and rejoined the ISR of {topic}-{partition}',
    leader: '{topic}-{partition}: broker {leader} is the new leader (epoch {epoch})',
    leaderUnclean:
      '{topic}-{partition}: unclean election, broker {leader} leads and data may be lost',
    leaderNone: '{topic}-{partition} is offline: no in-sync replica is alive',
    truncate:
      'Broker {broker} truncated {topic}-{partition} to offset {to}, dropping {lost} records',
    brokerDown: 'Broker {broker} stopped',
    brokerUp: 'Broker {broker} started',
    controller: 'Broker {broker} is the active controller',
    brokerSlow: 'Broker {broker} became slow',
    brokerFast: 'Broker {broker} is fast again',
    rebalanceStart: 'Group {group} started rebalancing ({reason})',
    rebalanceEnd: 'Group {group} finished rebalancing: generation {generation}, {members} members',
    segmentDeleted:
      'Retention deleted a segment of {topic}-{partition} on broker {broker} ({count} records)',
    compacted:
      'Compaction removed {removed} old records from {topic}-{partition} on broker {broker}',
    offsetReset: '{group} reset {topic}-{partition} to offset {to}',
    topicCreated: 'Topic {topic} created',
    topicDeleted: 'Topic {topic} deleted',
    partitionsAdded: 'Topic {topic} now has {count} partitions',
    configChanged: '{topic}: {key} = {value}',
    reasons: {
      join: 'a member joined',
      leave: 'a member left',
      timeout: 'a member timed out',
      metadata: 'topic metadata changed',
    },
  },
  legend: {
    title: 'How to read this',
    record: 'A record; the colour is its key',
    nullKey: 'No key',
    leader: 'Leader replica: takes writes and serves reads',
    follower: 'Follower replica: copies the leader',
    outOfSync: 'Out of the ISR: too far behind',
    hw: 'High watermark',
  },
};

export type KafkaStrings = typeof KAFKA_STRINGS;

const KafkaStringsContext = createContext<KafkaStrings>(KAFKA_STRINGS);

export function KafkaStringsProvider({
  strings,
  children,
}: {
  strings: KafkaStrings;
  children: ReactNode;
}) {
  return <KafkaStringsContext.Provider value={strings}>{children}</KafkaStringsContext.Provider>;
}

export const useKafkaStrings = () => useContext(KafkaStringsContext);

export { format };
