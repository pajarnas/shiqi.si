// Rewind for the cluster: @shiqi/sim's Timeline, told which cluster methods
// are actions to record. Everything else is read-only or internal.
import { Timeline as SimTimeline } from '@shiqi/sim';
import type { Cluster } from './cluster';

export type { TimelineEntry } from '@shiqi/sim';

/** Cluster methods that change it from outside. */
export const TIMELINE_ACTIONS = [
  'addBroker',
  'stopBroker',
  'startBroker',
  'restartBroker',
  'flushBroker',
  'setBrokerSlow',
  'configure',
  'createTopic',
  'deleteTopic',
  'addPartitions',
  'setTopicConfig',
  'preferredElection',
  'produce',
  'addProducer',
  'updateProducer',
  'removeProducer',
  'addConsumer',
  'removeConsumer',
  'crashConsumer',
  'updateConsumer',
  'deleteGroup',
  'commitOffsets',
  'setAuthorizer',
  'addAcl',
  'removeAcl',
] as const satisfies readonly (keyof Cluster)[];

export type TimelineAction = (typeof TIMELINE_ACTIONS)[number];

export class Timeline extends SimTimeline<Cluster, TimelineAction> {
  constructor(factory: () => Cluster) {
    super(factory, TIMELINE_ACTIONS);
  }

  /** The recording view of the current cluster (the same as `sim`). */
  get cluster(): Cluster {
    return this.sim;
  }
}
