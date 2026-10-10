// Every word @shiqi/kafka-viz shows. English is the default; apps pass their
// own translation through <KafkaStringsProvider> (the site keeps zh in its
// i18n/strings and lets the translation service fill the rest).
import { format } from '@shiqi/ui';
import { createContext, useContext, type ReactNode } from 'react';
import { BUILD_STRINGS } from './course/strings';

export const KAFKA_STRINGS = {
  toolbar: {
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    speed: 'Simulation speed',
    reset: 'Reset',
    clock: 'Simulated time {time}',
    timeline: 'Rewind or replay the simulated time',
    rewound: 'Rewound. Play replays what happened; any action starts a new history from here.',
    live: 'Live',
    goLive: 'Jump to now',
    lost: 'Acked records lost: {n}',
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
    restart: 'Restart',
    powerCut: 'Cut power',
    downHard: 'Power lost',
    pageCache: 'Cache',
    pageCacheHint: 'Written, but only in the page cache: lost if the power goes',
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
    redelivered: '{n} records processed twice',
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
    wire: 'Protocol',
    settings: 'Settings',
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
    ownHw: 'own HW {hw}',
    ownHwHint: "This replica's own copy of the high watermark, learned from fetch responses",
    legendDirty: 'only in the page cache',
    legendDiverged: 'differs from the leader at the same offset',
    gone: '{gone} records lost for good, {acked} of them acked',
    pickRecord: 'Click a record to follow its journey.',
  },
  journey: {
    title: 'Record {offset} of {topic}-{partition}',
    close: 'Close',
    key: 'Key',
    value: 'Value',
    none: 'null',
    hash: 'murmur2("{key}") = {hash}; toPositive → {positive}; mod {n} partitions = {partition}',
    sticky: 'No key: the sticky partitioner picked partition {partition} and kept it for the batch',
    produced: 'Written by {producer} to leader broker {broker} at {time}, leader epoch {epoch}',
    copy: 'Broker {broker}',
    copied: 'copied at {time}',
    leaderCopy: 'leader',
    missing: 'does not have it',
    onDisk: 'on disk',
    inCache: 'page cache only',
    committed: 'Committed at {time}: the high watermark passed it, so consumers can read it',
    notCommitted: 'Not committed yet: an in-sync replica still lacks it',
    acked: 'Producer told it was written at {time} (acks={acks})',
    ackFailed: 'Producer got {error}',
    waiting: 'Producer still waiting (acks=all)',
    consumed: '{group} first read it at {time}',
    notConsumed: '{group} has not read it yet',
    committedBy: '{group} committed past it',
    skipped: '{group} never read it: it started reading after this offset',
    twice: 'Delivered {n} times in all',
    gone: 'Lost for good at {time}: no replica holds it any more',
    unknown: 'The simulator did not see this record being produced.',
  },
  settings: {
    truncation: 'How a follower decides what to throw away',
    truncationModes: {
      'leader-epoch': 'Leader epoch (Kafka 0.11 and later, KIP-101)',
      'high-watermark': 'Its own high watermark (before 0.11)',
    },
    flush: 'Page cache writeback',
    flushEvery: 'every {s} s',
    flushNever: 'never (fsync off)',
    lag: 'replica.lag.time.max.ms',
    fetch: 'Follower fetch interval (ms)',
    session: 'session.timeout.ms',
    rebalanceDelay: 'group.initial.rebalance.delay.ms',
    note: 'Changes apply at once and are part of the timeline, so a rewind undoes them.',
  },
  wire: {
    intro:
      'The requests behind the animation for {topic}-{partition}, newest at the bottom. Time runs down; arrows go from who asks to who answers.',
    pick: 'Select a partition to see its requests.',
    empty: 'No requests yet. Let the simulation run.',
    coordinator: 'coordinator',
    controller: 'controller',
    produce: 'Produce key={key} → offset {offset}',
    ackOk: 'ProduceResponse offset {offset}',
    ackError: 'ProduceResponse {error}',
    fetch: 'Fetch offset={fromOffset} → {count} records',
    consume: 'Fetch offset={fromOffset} → {count} records',
    commit: 'OffsetCommit {offset}',
    join: 'JoinGroup ({reason})',
    sync: 'SyncGroup generation {generation}',
    leader: 'leader={leader} epoch={epoch}',
    epochQuery: 'OffsetsForLeaderEpoch → truncate to {to}',
    truncate: 'truncate to {to} ({reason})',
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
      'Broker {broker} truncated {topic}-{partition} to offset {to}, dropping {lost} records ({reason})',
    truncateGone: '{gone} of them existed nowhere else, {goneAcked} had been acked',
    truncateReasons: {
      epoch: 'the leader said where its epoch ended',
      hw: 'cut back to its own high watermark',
      unflushed: 'they were only in the page cache',
      ahead: 'it had more than the new leader',
    },
    brokerDown: 'Broker {broker} stopped',
    brokerPowerLoss: 'Broker {broker} lost power',
    flush: 'Broker {broker} wrote {bytes} bytes from the page cache to disk',
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
    dirty: 'Only in the page cache (not yet on disk)',
    diverged: 'Differs from the leader at the same offset',
    ownHw: "A follower's own high watermark",
  },
  glossary: {
    offset: {
      term: 'Offset',
      def: "A record's position in its partition: 0, 1, 2… Never reused, even after the record is deleted.",
    },
    partition: {
      term: 'Partition',
      def: 'An ordered, append-only log. A topic is split into partitions so it can be spread over brokers and read in parallel; order holds only inside one partition.',
    },
    replica: {
      term: 'Replica',
      def: 'A copy of a partition on one broker. Replication factor 3 means three copies on three brokers.',
    },
    leader: {
      term: 'Leader',
      def: 'The one replica that takes writes and serves reads for a partition. The others copy it.',
    },
    follower: {
      term: 'Follower',
      def: 'A replica that keeps fetching new records from the leader, ready to take over.',
    },
    isr: {
      term: 'ISR (in-sync replicas)',
      def: 'The replicas that have kept up with the leader within replica.lag.time.max.ms. Only they may become leader in a clean election.',
    },
    hw: {
      term: 'High watermark (HW)',
      def: 'The offset below which every in-sync replica has the record. Consumers only read below it, and acks=all is answered once it passes a record.',
    },
    leo: {
      term: 'Log end offset (LEO)',
      def: 'The offset the next record written to a replica will get: one past its last record.',
    },
    epoch: {
      term: 'Leader epoch',
      def: 'A counter that goes up with every new leader. Each record carries the epoch it was written in, so a returning replica can ask where its epoch ended and cut off exactly what diverged (KIP-101).',
    },
    acks: {
      term: 'acks',
      def: 'How long the producer waits: 0 = not at all, 1 = until the leader wrote it, all = until every in-sync replica has it.',
    },
    minIsr: {
      term: 'min.insync.replicas',
      def: 'With acks=all, the leader refuses writes (NOT_ENOUGH_REPLICAS) while the ISR is smaller than this. It is what makes acks=all mean "on N brokers".',
    },
    unclean: {
      term: 'Unclean leader election',
      def: 'Letting a replica outside the ISR become leader when no in-sync one is alive. The partition comes back, but records only the old leader had are lost.',
    },
    pageCache: {
      term: 'Page cache',
      def: 'Memory the operating system uses to buffer file writes. Kafka writes go there first and reach the disk later; Kafka relies on replication, not fsync, for durability.',
    },
    fsync: {
      term: 'fsync',
      def: 'Forcing the page cache onto the disk. Kafka leaves this to the OS by default; a power cut loses whatever was not yet written.',
    },
    truncate: {
      term: 'Truncation',
      def: 'A replica cutting off the end of its log because it does not match the leader. Records cut this way exist only if another replica still has them.',
    },
    segment: {
      term: 'Segment',
      def: 'A partition is stored as a series of files, each named after its first offset. Retention and compaction work on whole closed segments.',
    },
    retention: {
      term: 'Retention',
      def: 'Deleting old segments by age (retention.ms) or size (retention.bytes), whether anyone read them or not.',
    },
    compaction: {
      term: 'Log compaction',
      def: 'Keeping only the latest record for each key, so the log becomes a table of current values. Offsets of removed records leave gaps.',
    },
    tombstone: {
      term: 'Tombstone',
      def: 'A record with a key and a null value: on a compacted topic it deletes the key, and is itself removed after delete.retention.ms.',
    },
    group: {
      term: 'Consumer group',
      def: "Consumers sharing one group id split a topic's partitions between them; each partition goes to one member.",
    },
    rebalance: {
      term: 'Rebalance',
      def: 'Re-dividing partitions when members join, leave or time out. The group coordinator runs it; the assignor decides who gets what.',
    },
    commit: {
      term: 'Committed offset',
      def: 'The position a group has saved for a partition: where a member starts reading after a restart or rebalance.',
    },
    lag: {
      term: 'Lag',
      def: 'How far a group is behind: the high watermark minus its position (or committed offset).',
    },
    coordinator: {
      term: 'Group coordinator',
      def: 'The broker that manages one consumer group: membership, generations and committed offsets (kept in the __consumer_offsets topic).',
    },
    controller: {
      term: 'Controller',
      def: 'The broker that elects partition leaders and records metadata changes. In KRaft mode a quorum of controllers keeps the metadata log.',
    },
    murmur2: {
      term: 'murmur2 partitioner',
      def: 'The default partitioner hashes the key bytes with murmur2 and takes it modulo the number of partitions. Same key, same partition, as long as the partition count does not change.',
    },
    session: {
      term: 'session.timeout.ms',
      def: 'How long the coordinator waits for a silent consumer before removing it. A crash is only noticed after this.',
    },
  },
  scenarios: {
    open: 'Guided scenarios',
    intro:
      'Short stories played on a live cluster, taken from Kafka design documents and loss tests. At each step, guess what will happen, then watch it happen.',
    groups: {
      basics: 'Basics',
      durability: 'Durability',
      kip101: 'KIP-101: leader epochs',
      consumers: 'Consumer groups',
      log: 'Keys and the log',
    },
    start: 'Start',
    exit: 'Leave the scenario',
    progress: 'Step {n} of {total}',
    play: 'Play this step',
    playing: 'Playing…',
    lockIn: 'Lock in my guess and play',
    next: 'Next step',
    back: 'Previous step',
    replay: 'Replay this step',
    finished: 'End of this story.',
    continueWith: 'Continue: {title}',
    source: 'Based on',
    sources: {
      kip101: 'KIP-101 (Apache Kafka)',
      vanlightly: 'Jack Vanlightly, "How to Lose Messages on a Kafka Cluster"',
      kip429: 'KIP-429 (Apache Kafka)',
    },
    list: {
      'first-record': {
        title: 'The life of one record',
        summary: 'Follow one record from the producer to three brokers to a consumer.',
        steps: {
          cluster: {
            title: 'Three brokers, one topic',
            body: 'Each box is a broker: a server with a disk. The topic <b>orders</b> has 3 <partition>partitions</partition>, and each partition has 3 <replica>replicas</replica>, one per broker. In every row, <b>L</b> marks the <leader>leader</leader> and <b>F</b> the <follower>followers</follower>. Leaders are spread so each broker leads one partition.',
            result: '',
          },
          send: {
            title: 'Send a record',
            body: 'The producer <b>app</b> sends key <b>alice</b>, value "order #1", with <acks>acks=all</acks>. The <murmur2>partitioner</murmur2> hashes "alice" and picks partition {partition}.',
            question: 'When does app get its answer?',
            options: [
              'As soon as the leader has written it',
              'When every in-sync replica has it',
              'When a consumer has read it',
            ],
            result:
              'The record lands on the leader first. The followers fetch it, and only when their next fetch shows the leader they have it does the <hw>high watermark</hw> move past it. That is when acks=all is answered.',
          },
          hw: {
            title: 'Why the high watermark lags',
            body: 'Followers pull: every 250 ms each one asks the leader for records from its own <leo>log end offset</leo>. That fetch offset is how the leader learns how far the follower got, so the HW moves one fetch after the copy arrives, and the follower hears the new HW one fetch later still. Look at the small "own HW" mark on each follower row in the inspector.',
            result: '',
          },
          read: {
            title: 'A consumer joins',
            body: 'A consumer group <b>billing</b> starts with one member and auto.offset.reset=earliest.',
            question: 'Where does it start reading?',
            options: [
              'At offset 0: the group has no committed offset, and earliest means the start of the log',
              'At the end: it only sees records sent after it joined',
              'Wherever another group stopped',
            ],
            result:
              'It joined the group, the <coordinator>coordinator</coordinator> gave it all three partitions after a short <rebalance>rebalance</rebalance>, and it fetched from offset 0. It can only read below the high watermark.',
          },
          commit: {
            title: 'Saving progress',
            body: "Reading does not tell Kafka anything. Every auto.commit.interval.ms (5 s by default) the consumer sends its position as the group's <commit>committed offset</commit>.",
            result:
              "The pin in the inspector is billing's committed offset: 1, the next record to read. If billing restarts, it resumes there. Anything read but not yet committed would be read again: that is at-least-once delivery.",
          },
        },
      },
      'acks-one': {
        title: 'acks=1 loses acked writes',
        summary: 'The leader confirms a write no follower has, then dies.',
        steps: {
          flow: {
            title: 'Fast and confirmed',
            body: '<b>pay-svc</b> sends 20 records a second with <acks>acks=1</acks>: the leader answers as soon as it has written a record, without waiting for any follower.',
            result: '',
          },
          lag: {
            title: 'The followers fall behind',
            body: 'Both followers get a slow disk and now fetch only every 10 seconds. They stay in the <isr>ISR</isr> for a while: they are not removed until replica.lag.time.max.ms (6 s here) passes without them catching up.',
            question: 'Does pay-svc notice?',
            options: [
              'No: acks=1 never waited for followers, so every write is still confirmed',
              'Yes: it starts getting errors',
              'Yes: it slows down to match the followers',
            ],
            result:
              'Nothing changes for the producer. But the leader now holds dozens of confirmed records that no other broker has.',
          },
          crash: {
            title: 'The leader dies',
            body: "The leader's broker crashes. A follower is still in the ISR, so the controller elects it, with a new <epoch>leader epoch</epoch>.",
            question: 'What happens to the records only the old leader had?',
            options: [
              'The new leader still has them',
              'They are gone, though pay-svc was told they were written',
              'pay-svc gets an error for each of them',
            ],
            result:
              'The new leader starts from its own log end. pay-svc keeps writing to it, and those new records take the same offsets the lost ones had.',
          },
          back: {
            title: 'The old leader comes back',
            body: 'The old leader restarts as a follower. Its log has records the new leader never saw, at offsets now used by other records.',
            result:
              'It asked the new leader where its epoch ended and <truncate>truncated</truncate> everything after: {lost} acknowledged records are gone for good. Jack Vanlightly measured the same thing on a real cluster: a clean failover with acks=1 lost writes in every run.',
          },
          lesson: {
            title: 'What to do instead',
            body: 'Use acks=all with replication factor 3 and <minIsr>min.insync.replicas</minIsr>=2: a write is confirmed only once two brokers have it, so one failure cannot lose it. The next scenario shows why min.insync.replicas matters.',
            result: '',
          },
        },
      },
      'min-isr': {
        title: 'acks=all is only as strong as the ISR',
        summary: 'With min.insync.replicas=1, "all" can mean one broker.',
        steps: {
          healthy: {
            title: 'All three in sync',
            body: '<b>ledger-svc</b> uses acks=all. Each record is confirmed once all three replicas have it.',
            result: '',
          },
          shrink: {
            title: 'The followers fall out',
            body: 'Both followers get slow disks. After replica.lag.time.max.ms without catching up, the leader removes them from the <isr>ISR</isr>.',
            question: 'What does acks=all wait for now?',
            options: [
              'Still all three replicas',
              'Only the leader: the ISR is all it waits for, and the ISR is just the leader',
              'Nothing: writes are refused',
            ],
            result: 'The ISR is the leader alone. acks=all now means "the leader wrote it".',
          },
          acked: {
            title: 'Still confirmed',
            body: 'The producer keeps getting acks, with no errors, exactly as before.',
            result: '',
          },
          cut: {
            title: 'The leader loses power',
            body: "Kafka does not fsync each write: records sit in the OS <pageCache>page cache</pageCache> until writeback (every 5 s here). Now the leader's machine loses power and reboots.",
            question: 'What is left on the leader?',
            options: [
              'Everything it confirmed',
              'Only what the OS had already written to disk',
              'The followers fill in what it lost',
            ],
            result:
              "{lost} confirmed records were only in memory and nobody else had them. They are gone. Jack Vanlightly's test with acks=all and an ISR shrunk to the leader lost data the same way.",
          },
          fix: {
            title: 'Set min.insync.replicas=2',
            body: 'Raise <minIsr>min.insync.replicas</minIsr> to 2 while the followers are still slow.',
            question: 'What will ledger-svc see?',
            options: [
              'Nothing changes',
              'NOT_ENOUGH_REPLICAS errors until a follower is back in sync',
              'The followers speed up',
            ],
            result:
              'The leader refuses writes it cannot protect. The producer sees errors and can retry later: Kafka trades availability for durability, which is what you want for a ledger.',
          },
          heal: {
            title: 'The followers recover',
            body: 'The disks are fixed. The followers fetch normally again, catch up to the high watermark and rejoin the ISR.',
            result:
              'With two replicas in sync, writes are accepted again. Replication factor 3 with min.insync.replicas=2 survives one broker failure without losing confirmed writes and without stopping.',
          },
        },
      },
      unclean: {
        title: 'Unclean leader election',
        summary: 'Availability or durability, when the only in-sync replica dies.',
        steps: {
          shrink: {
            title: 'One replica in sync',
            body: '<b>tracker</b> writes with acks=1. Both followers slow down and drop out of the <isr>ISR</isr>; only the leader is left.',
            result: '',
          },
          die: {
            title: 'The last in-sync replica dies',
            body: 'The leader crashes. Two followers are alive, but neither is in the ISR.',
            question: 'What happens to the partition?',
            options: [
              'A follower takes over at once',
              'It goes offline: no in-sync replica is alive to lead',
              'The producer writes to another broker',
            ],
            result:
              'With <unclean>unclean.leader.election.enable</unclean>=false (the default) the partition stays offline until an in-sync replica returns. Writes fail with no leader.',
          },
          allow: {
            title: 'Allow unclean election',
            body: 'Turn on unclean.leader.election.enable for this topic.',
            question: 'What do you get, and what do you pay?',
            options: [
              'It comes back, and nothing is lost',
              'It comes back, but records the new leader never fetched are lost',
              'Nothing happens until the old leader returns',
            ],
            result:
              'A follower that was far behind becomes leader at once and the partition is writable again. Its log is missing everything it had not fetched.',
          },
          back: {
            title: 'The old leader returns',
            body: 'The old leader restarts and finds a new leader with a shorter, different log.',
            result:
              "It truncates to match: {lost} acknowledged records are gone. In Vanlightly's test, unclean election lost far more than a clean failover, because the new leader was so far behind.",
          },
        },
      },
      'kip101-restart-hw': {
        title: 'KIP-101, part 1: a restart loses an acked record (Kafka 0.10)',
        summary:
          'Followers used to cut back to their own high watermark. Watch why that was wrong.',
        steps: {
          m1: {
            title: 'Two brokers, one record',
            body: 'This cluster behaves like Kafka before 0.11. Broker 1 leads, broker 2 follows. The producer sends m1 with acks=all.',
            result: '',
          },
          m2: {
            title: 'A second record',
            body: 'The producer sends m2. The follower fetches it, the leader sees that on the next fetch, moves the <hw>HW</hw> to 2 and acks m2.',
            question: 'What high watermark does the follower have on record right now?',
            options: [
              '2, the same as the leader',
              '1: it learns the new HW only in its next fetch response',
              '0',
            ],
            result:
              'The follower holds m2 but its own HW is still 1. Look at the "own HW" mark on broker 2 in the inspector.',
          },
          bounce: {
            title: 'The follower restarts',
            body: 'Broker 2 restarts quickly, before anyone notices; it stays in the ISR.',
            question: 'What does it do with m2?',
            options: [
              'Keeps it',
              'Cuts its log back to its own HW and drops m2, to fetch it again later',
              'Deletes its whole log',
            ],
            result:
              'Before KIP-101 a follower truncated to its own high watermark on restart, to throw away anything that might not be committed. That drops m2, which is committed.',
          },
          fail: {
            title: 'The leader dies',
            body: 'Before broker 2 fetches m2 again, broker 1 crashes. Broker 2 is in the ISR, so it becomes leader.',
            question: 'Is m2 still in the partition?',
            options: ['Yes', 'No'],
            result: 'The new leader does not have m2. Its log ends at offset 1.',
          },
          back: {
            title: 'Broker 1 returns',
            body: 'Broker 1 restarts and follows broker 2.',
            result:
              'Broker 1 has more than the leader, so it truncates too. {lost} acknowledged record lost, with no unclean election and no misconfiguration. This is scenario 1 of KIP-101. Next: the same story with leader epochs.',
          },
        },
      },
      'kip101-restart-epoch': {
        title: 'KIP-101, part 2: the same restart with leader epochs (Kafka 0.11+)',
        summary:
          'Followers ask the leader where their epoch ended instead of trusting their own HW.',
        steps: {
          m1: {
            title: 'Same start',
            body: 'The same two brokers and the same producer, but this cluster uses <epoch>leader epochs</epoch> for truncation, like every Kafka since 0.11.',
            result: '',
          },
          m2: {
            title: 'A second record',
            body: "The producer sends m2. As before, the leader acks it after the follower's next fetch.",
            question: 'What high watermark does the follower have on record?',
            options: ['2', '1: it hears the new HW one fetch later', '0'],
            result: 'Same as before: the follower has m2, but its own HW is 1.',
          },
          bounce: {
            title: 'The follower restarts',
            body: 'Broker 2 restarts quickly and stays in the ISR.',
            question: 'What does it do with m2 this time?',
            options: [
              'Keeps it: it does not use its own HW to decide',
              'Cuts back to its HW and drops m2',
              'Deletes its whole log',
            ],
            result:
              'It keeps its log. Every record carries the epoch it was written in; on its next fetch the follower sends an OffsetsForLeaderEpoch request: "where did epoch 0 end?" and cuts only past that offset.',
          },
          fail: {
            title: 'The leader dies',
            body: 'Broker 1 crashes and broker 2 becomes leader.',
            question: 'Is m2 still in the partition?',
            options: ['Yes', 'No'],
            result: 'Yes: broker 2 still has m1 and m2.',
          },
          back: {
            title: 'Broker 1 returns',
            body: 'Broker 1 restarts and follows broker 2.',
            result:
              "Epoch 0 ended at offset 2 on the new leader, so broker 1 keeps everything. Records lost: {lost}. Next: KIP-101's second scenario, where both brokers lose power.",
          },
        },
      },
      'kip101-power-hw': {
        title: 'KIP-101, part 3: logs diverge after a power cut (Kafka 0.10)',
        summary:
          'Two replicas end up with different records at the same offset, and both look in sync.',
        steps: {
          m1: {
            title: 'One record, on disk everywhere',
            body: 'Before 0.11 again. The OS writeback is off here, so we flush by hand to show exactly what reaches the disk.',
            result: '',
          },
          m2: {
            title: 'A second record',
            body: 'Both brokers write m1 to disk, then the producer sends m2 and it is acked. m2 is in both <pageCache>page caches</pageCache> but on neither disk.',
            result: 'Striped cells are records only in memory.',
          },
          writeback: {
            title: 'One writeback happens',
            body: "Broker 1's OS happens to write its dirty pages to disk. Broker 2's has not got to it yet.",
            result: '',
          },
          outage: {
            title: 'Power fails everywhere',
            body: 'The whole rack loses power: broker 1 first, then broker 2.',
            question: 'What does broker 2 have after the outage?',
            options: ['m1 and m2', 'Only m1: m2 was in its page cache', 'Nothing'],
            result: 'Broker 1 still has m1 and m2 on disk; broker 2 only m1.',
          },
          'b-first': {
            title: 'Broker 2 boots first',
            body: 'Broker 2 is the last in-sync replica, so it becomes leader in a new epoch, and the producer sends m3. It lands at offset 1, where broker 1 has m2.',
            result: '',
          },
          'a-back': {
            title: 'Broker 1 boots',
            body: 'Broker 1 starts as a follower. Its own high watermark is 2, and its log ends at 2.',
            question: 'What happens at offset 1?',
            options: [
              'Nothing: broker 1 keeps m2 while the leader has m3, and both count as in sync',
              'Broker 1 drops m2 and copies m3',
              'The leader copies m2 from broker 1',
            ],
            result:
              "Broker 1 truncates to its own HW (2), fetches from offset 2, finds nothing new, and rejoins the ISR. The two replicas now disagree at offset 1 (highlighted cells) and nothing will ever notice. This is KIP-101's scenario 2.",
          },
        },
      },
      'kip101-power-epoch': {
        title: 'KIP-101, part 4: the power cut with leader epochs',
        summary: 'Epochs keep the replicas identical, though the unflushed write is still gone.',
        steps: {
          m1: {
            title: 'Same start',
            body: 'The same power-cut story, now with leader epochs.',
            result: '',
          },
          m2: {
            title: 'A second record',
            body: 'm1 is on both disks; m2 is acked but only in the page caches.',
            result: '',
          },
          writeback: {
            title: 'One writeback happens',
            body: 'Broker 1 writes its dirty pages to disk. Broker 2 does not.',
            result: '',
          },
          outage: {
            title: 'Power fails everywhere',
            body: 'Broker 1, then broker 2, loses power.',
            question: 'What does broker 2 have after the outage?',
            options: ['m1 and m2', 'Only m1', 'Nothing'],
            result: 'Broker 2 only has m1.',
          },
          'b-first': {
            title: 'Broker 2 boots first',
            body: 'Broker 2 leads in a new epoch and takes m3 at offset 1.',
            result: '',
          },
          'a-back': {
            title: 'Broker 1 boots',
            body: 'Broker 1 starts as a follower with m2 at offset 1, written in epoch 0.',
            question: 'What happens at offset 1?',
            options: [
              'Broker 1 keeps m2',
              'Broker 1 asks where epoch 0 ended, drops m2 and copies m3',
              'The leader copies m2',
            ],
            result:
              "The leader answers that epoch 0 ended at offset 1, so broker 1 truncates m2 and fetches m3. The replicas agree again. m2 is still lost: it was acked but on no disk except one that was overruled. Kafka's answer is not fsync but replicas on separate power, racks or zones.",
          },
        },
      },
      rebalance: {
        title: 'Eager vs cooperative rebalancing',
        summary: 'Two groups get a new member at the same moment. One stops, one keeps reading.',
        steps: {
          steady: {
            title: 'Two groups, same work',
            body: '<b>eager-app</b> uses the range assignor with the eager protocol; <b>coop-app</b> uses cooperative-sticky. Each has two members reading the six partitions of orders.',
            result: '',
          },
          join: {
            title: 'A third member joins each',
            body: 'One new consumer joins each group at the same moment, which starts a <rebalance>rebalance</rebalance> in both.',
            question: 'Which group stops reading while it rebalances?',
            options: [
              'Both',
              'Only eager-app: every member gives up every partition before the new assignment',
              'Only coop-app',
            ],
            result:
              'eager-app stopped the world: all members revoked everything and waited. coop-app kept reading the partitions that did not move and paused only those that changed hands (KIP-429).',
          },
          kip848: {
            title: 'The next protocol',
            body: 'Kafka 4.0 made a new consumer protocol generally available (KIP-848, group.protocol=consumer): the coordinator computes assignments itself and members reconcile one partition at a time, with no group-wide barrier at all.',
            result: '',
          },
        },
      },
      'crash-vs-leave': {
        title: 'A crash is not a goodbye',
        summary: 'Clean shutdown vs crash, and why at-least-once means duplicates.',
        steps: {
          steady: {
            title: 'Three workers',
            body: 'Group <b>workers</b> has three members sharing four partitions of jobs. They commit every 5 s.',
            result: '',
          },
          leave: {
            title: 'worker-3 shuts down cleanly',
            body: 'worker-3 commits its position and sends LeaveGroup.',
            question: 'How long until its partition is picked up?',
            options: [
              'Right away: the coordinator rebalances as soon as it hears LeaveGroup',
              'After session.timeout.ms',
              'Never',
            ],
            result: 'The group rebalanced immediately and nothing was read twice.',
          },
          crash: {
            title: 'worker-2 crashes',
            body: 'worker-2 dies: no LeaveGroup, no final commit, it just stops heartbeating.',
            question: 'What happens to its partitions?',
            options: [
              'Taken over at once',
              'Nobody reads them until session.timeout.ms (8 s here) runs out',
              'Their records are lost',
            ],
            result:
              'The coordinator could not tell a crash from a pause, so it waited out the <session>session timeout</session>. Lag built up meanwhile. Then it removed worker-2 and rebalanced.',
          },
          dupes: {
            title: "Who reads worker-2's records?",
            body: "worker-1 now owns all four partitions and starts each from the group's committed offset.",
            question: 'What about records worker-2 had processed but not yet committed?',
            options: ['Skipped', 'Processed again by worker-1', 'Lost'],
            result:
              '{n} records were processed twice. That is at-least-once delivery: make processing idempotent, or use transactions to commit output and offsets together.',
          },
        },
      },
      keys: {
        title: 'Keys, order and partitions',
        summary: 'Same key, same partition; until the partition count changes.',
        steps: {
          'same-key': {
            title: 'Keys pick partitions',
            body: '<b>bank</b> sends updates for six accounts, keyed by name. Colours are keys.',
            question: "How is a key's partition chosen?",
            options: [
              'Round robin',
              'murmur2(key) modulo the number of partitions',
              'The least busy partition',
            ],
            result:
              'With 3 partitions: {map}. Every update for one account goes to one partition, so they are read in the order they were written. Kafka guarantees order only within a partition.',
          },
          grow: {
            title: 'Add a partition',
            body: 'Grow accounts from 3 to 4 partitions.',
            question: 'Do the keys stay where they were?',
            options: [
              'Yes, always',
              'Many move: the modulus changed',
              'Kafka moves the old records along with them',
            ],
            result:
              'These keys now go to a different partition: {moved}. Their old records stay where they were, so a consumer can see a newer update before an older one. Plan partition counts up front for keyed topics.',
          },
          idle: {
            title: 'Five consumers, four partitions',
            body: 'Four more auditors join the one already reading.',
            question: 'What does the fifth consumer do?',
            options: [
              'Shares a partition with another member',
              'Nothing: each partition goes to exactly one member of a group',
              'Reads every partition',
            ],
            result:
              'One auditor sits idle. More consumers than partitions adds no throughput; it only gives you a spare.',
          },
        },
      },
      retention: {
        title: 'Retention and compaction',
        summary:
          'Old data is deleted on a schedule, read or not; compaction keeps the latest per key.',
        steps: {
          segments: {
            title: 'Segments roll',
            body: 'Each partition is stored as <segment>segment</segment> files named after their first offset. app-logs rolls a new segment every 600 bytes and keeps them for 15 s.',
            result: '',
          },
          expire: {
            title: 'A slow reader',
            body: 'The <b>archiver</b> reads one record every two seconds; the producer writes eight a second.',
            question: 'What happens when records it has not read yet expire?',
            options: [
              'Kafka keeps them until it has read them',
              'They are deleted anyway, and its position jumps to the new start of the log',
              'They move to another broker',
            ],
            result:
              "<retention>Retention</retention> deleted whole segments by age. The archiver's next fetch was out of range, and auto.offset.reset moved it to the earliest offset left. The records in between were never read.",
          },
          compact: {
            title: 'A compacted topic',
            body: 'profiles is compacted: three keys updated over and over. Watch the inspector.',
            question: 'What is left of a key updated twenty times?',
            options: [
              'All twenty updates',
              'The latest, with gaps where older offsets were removed',
              'Nothing',
            ],
            result:
              '<compaction>Compaction</compaction> rewrote closed segments keeping the newest record per key. Offsets are never reused, so the log has holes. <tombstone>Tombstones</tombstone> (null values) delete a key.',
          },
        },
      },
    },
  },
  build: BUILD_STRINGS,
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
