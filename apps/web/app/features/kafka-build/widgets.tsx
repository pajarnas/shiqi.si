// The "Build your own Kafka" widgets with the providers they need. Loaded
// on demand by the islands in a chapter, so other notes don't pay for them.
import '@shiqi/code/styles.css';
import '@shiqi/kafka-viz/styles.css';

import { CodeStringsProvider } from '@shiqi/code';
import { KafkaStringsProvider } from '@shiqi/kafka-viz';
import {
  BuildExercise,
  IndexLookup,
  PageCacheDemo,
  QueueVsLog,
  RecordBytes,
  SegmentsDemo,
} from '@shiqi/kafka-viz/course';
import type { PolicyName } from '@shiqi/kafka/storage';
import { useI18n } from '~/i18n';

const WIDGETS = {
  queueVsLog: QueueVsLog,
  recordBytes: RecordBytes,
  indexLookup: IndexLookup,
  segments: SegmentsDemo,
  pageCache: PageCacheDemo,
};

export type KafkaWidgetName = keyof typeof WIDGETS | 'exercise';

export default function KafkaWidget({
  widget,
  policy,
}: {
  widget: KafkaWidgetName;
  policy?: PolicyName;
}) {
  const { t } = useI18n();
  const Widget = widget === 'exercise' ? null : WIDGETS[widget];
  return (
    <CodeStringsProvider strings={t.code}>
      <KafkaStringsProvider strings={t.kafka.lab}>
        {Widget ? <Widget /> : policy ? <BuildExercise policy={policy} /> : null}
      </KafkaStringsProvider>
    </CodeStringsProvider>
  );
}
