# @shiqi/kafka

A Kafka cluster in memory, for teaching and visualizing. No framework, no I/O.

```ts
import { Cluster, runCli } from '@shiqi/kafka';

const c = new Cluster({ brokers: 3, seed: 1984 });
c.createTopic('orders', {
  partitions: 3,
  replicationFactor: 3,
  config: { 'min.insync.replicas': 2 },
});
c.addProducer({ topic: 'orders', rate: 5, acks: 'all', keys: 'fixed' });
c.addConsumer({ group: 'billing', topics: ['orders'] });
c.onEvent((e) => console.log(e.type));
c.tick(1000); // advance one simulated second
c.stopBroker(1); // leaders fail over, the ISR shrinks
console.log(runCli(c, 'kafka-topics --describe --topic orders').lines.join('\n'));
```

What it models: murmur2 key partitioning and the sticky partitioner, Kafka's replica placement, follower fetching with ISR shrink and expand, the high watermark, acks 0/1/all with `min.insync.replicas`, leader election with leader epochs and truncation of diverged followers, offline partitions and unclean election, segment rolling, time and size retention, log compaction with tombstones, consumer groups with range/roundrobin/cooperative-sticky assignment, eager vs cooperative rebalances, session timeouts, auto-commit, lag and offset resets.

`runCli` speaks the stock scripts (`kafka-topics`, `kafka-configs`, `kafka-console-producer`, `kafka-console-consumer`, `kafka-consumer-groups`, `kafka-leader-election`, `kafka-metadata-quorum`, `kafka-producer-perf-test`) with their real flags and output formats.

It also models what usually stays invisible: each follower's own high watermark (one fetch behind the leader's), the page cache (`flushIntervalMs`, `stopBroker(id, { hard: true })` loses what wasn't flushed), quick restarts (`restartBroker`), truncation by leader epoch or, as before Kafka 0.11, by high watermark (`truncation: 'high-watermark'`), records lost for good (`partition.gone`, `goneAcked`), redeliveries after a consumer crash, and a trace of every record (`cluster.trace(record)`).

Time moves in fixed steps (`tickMs`), so every random choice comes from the seed and a seed plus the same actions replays the same history whatever the frame rate. `Timeline` builds on that: act through `timeline.cluster`, and `timeline.seek(t)` rewinds by replaying.

```ts
import { Timeline } from '@shiqi/kafka';
const tl = new Timeline(() => new Cluster({ seed: 7 }));
tl.cluster.tick(5000);
tl.cluster.stopBroker(1);
tl.seek(2000); // back before the stop
```
