# @shiqi/kafka-viz

React views for [`@shiqi/kafka`](../kafka), styled with `@shiqi/ui`'s theme tokens.

```tsx
import '@shiqi/ui/styles.css';
import '@shiqi/kafka-viz/styles.css';
import { KafkaLab } from '@shiqi/kafka-viz';

<KafkaLab />; // a running demo cluster: stage, inspector, terminal, panels, events
```

The pieces work alone too: `Stage` (producers, a server chassis per broker with every replica's log, consumer groups, and records flying between them on a canvas), `Inspector` (segment files, offsets, high watermark, committed offsets), `Terminal` (the CLI emulator), `EventLog`, and `TopicsPanel` / `ProducersPanel` / `ConsumersPanel`. `useSimulation` drives a cluster from `requestAnimationFrame`; `useClusterVersion` re-renders at a throttled rate.

`<KafkaLab scenario="acks-one" />` opens a guided scenario: a short story on a live cluster where each step asks for a prediction, plays, then explains. The twelve scenarios (`SCENARIOS`) follow KIP-101, Jack Vanlightly's Kafka loss tests and KIP-429, and `scenarios.test.ts` checks each plays out as its text says. Also here: `RecordJourney` (one record from partitioner to consumer), `WireView` (the requests behind a partition as a sequence diagram), `SettingsPanel`, and `Explain`, which renders glossary tags like `<hw>high watermark</hw>` as terms with definitions.

All text comes from `KAFKA_STRINGS` (English); pass a translation with `<KafkaStringsProvider>`.
