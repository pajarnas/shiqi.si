// Rewind for the broker: @shiqi/sim's Timeline, told which broker methods are
// actions to record. Everything else is read-only or internal.
import { Timeline as SimTimeline } from '@shiqi/sim';
import type { Broker } from './broker';

/** Broker methods that change it from outside. */
export const BROKER_ACTIONS = [
  'configure',
  'declareExchange',
  'deleteExchange',
  'declareQueue',
  'deleteQueue',
  'purgeQueue',
  'getMessages',
  'bind',
  'unbind',
  'publish',
  'addPublisher',
  'updatePublisher',
  'removePublisher',
  'publishFrom',
  'addConsumer',
  'updateConsumer',
  'removeConsumer',
  'crashConsumer',
  'restartConsumer',
] as const satisfies readonly (keyof Broker)[];

export type BrokerAction = (typeof BROKER_ACTIONS)[number];

export class BrokerTimeline extends SimTimeline<Broker, BrokerAction> {
  constructor(factory: () => Broker) {
    super(factory, BROKER_ACTIONS);
  }
}
