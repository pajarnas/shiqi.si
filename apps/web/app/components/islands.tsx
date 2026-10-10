// Interactive widgets that notes can place with <Island name="…" />. Each
// entry loads its code only when a page actually contains it.
import type { IslandRegistry } from '@shiqi/ui';
import { lazy, Suspense } from 'react';
import type { KafkaWidgetName } from '~/features/kafka-build/widgets';

const KafkaWidget = lazy(() => import('~/features/kafka-build/widgets'));

const kafka = (widget: KafkaWidgetName) =>
  function KafkaIsland(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<div className="ui-island__loading" />}>
        <KafkaWidget widget={widget} {...props} />
      </Suspense>
    );
  };

export const ISLANDS: IslandRegistry = {
  'kafka.queueVsLog': kafka('queueVsLog'),
  'kafka.recordBytes': kafka('recordBytes'),
  'kafka.indexLookup': kafka('indexLookup'),
  'kafka.segments': kafka('segments'),
  'kafka.pageCache': kafka('pageCache'),
  'kafka.exercise': kafka('exercise'),
};
