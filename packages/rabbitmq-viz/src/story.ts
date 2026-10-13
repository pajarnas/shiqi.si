// Story mode for the RabbitMQ stories: which events stop the story, which
// text explains each, and which cards it points at.
import type { Broker, BrokerEvent } from '@shiqi/rabbitmq';
import { BeatFilter as SimBeatFilter, eventVars, type Beat as SimBeat } from '@shiqi/sim';
import { anchorId } from './anchors';
import type { RabbitStrings } from './strings';

export type BeatKind = keyof RabbitStrings['story']['beats'];
export type Beat = SimBeat<BrokerEvent, BeatKind>;

/** Which text explains this event; null for events a story never stops for. */
export function beatKind(e: BrokerEvent): BeatKind | null {
  switch (e.type) {
    case 'publish':
    case 'route':
    case 'ack':
    case 'requeue':
    case 'drop':
      return e.type as BeatKind;
    case 'unroutable':
      return e.outcome === 'returned' ? 'unroutableReturned' : 'unroutableDropped';
    case 'confirm':
      return e.ok ? 'confirmOk' : 'confirmNack';
    case 'deliver':
      return e.redelivered ? 'deliverAgain' : 'deliver';
    case 'process':
      return e.ok ? null : 'processFail';
    case 'nack':
      return e.requeue ? 'nackRequeue' : 'reject';
    case 'dead-letter':
      return 'deadLetter';
    case 'reject-publish':
      return 'rejectPublish';
    case 'consumer-down':
      return 'consumerDown';
    case 'consumer-up':
      return 'consumerUp';
    case 'active-consumer':
      return 'activeConsumer';
    default:
      return null;
  }
}

/** Steady traffic: explained the first time per publisher, queue or consumer, then let through. */
const REPEATING = new Set<BeatKind>([
  'publish',
  'route',
  'deliver',
  'deliverAgain',
  'ack',
  'confirmOk',
  'requeue',
  'nackRequeue',
  'processFail',
]);

function repeatKey(kind: BeatKind, e: BrokerEvent): string {
  const who =
    'consumer' in e
      ? e.consumer
      : e.type === 'route'
        ? `${e.exchange}>${e.queues.join(',')}`
        : 'publisher' in e
          ? e.publisher
          : 'queue' in e
            ? e.queue
            : '';
  return `${kind}:${who}`;
}

/** The cards an event is about, so the stage can point at them. */
export function focusOf(e: BrokerEvent, b: Broker): string[] {
  const pub = (id: string | null) => (id && b.publishers.has(id) ? [anchorId.publisher(id)] : []);
  switch (e.type) {
    case 'publish':
      return [...pub(e.publisher), anchorId.exchange(e.exchange)];
    case 'route':
      return [anchorId.exchange(e.exchange), ...e.queues.map(anchorId.queue)];
    case 'unroutable':
      return [anchorId.exchange(e.exchange), ...pub(e.publisher)];
    case 'confirm':
      return pub(e.publisher);
    case 'deliver':
    case 'ack':
    case 'nack':
    case 'process':
    case 'consumer-down':
    case 'consumer-up':
    case 'active-consumer':
      return [anchorId.queue(e.queue), anchorId.consumer(e.consumer)];
    case 'dead-letter':
      return [anchorId.queue(e.queue), anchorId.exchange(e.exchange)];
    case 'requeue':
    case 'drop':
    case 'reject-publish':
      return [anchorId.queue(e.queue)];
    default:
      return [];
  }
}

export class BeatFilter extends SimBeatFilter<BrokerEvent, Broker, BeatKind> {
  constructor() {
    super({ kind: beatKind, repeating: REPEATING, repeatKey, focus: focusOf });
  }
}

/** An event's fields as template values, in words: names for the nameless, reasons translated. */
export function eventWords(e: BrokerEvent, t: RabbitStrings): Record<string, string | number> {
  const v = eventVars(e);
  if ('exchange' in e) v.exchange = e.exchange || t.exchange.default;
  if ('key' in e) v.key = e.key === '' ? '""' : e.key;
  if ('publisher' in e) v.publisher = e.publisher ?? 'rabbitmqadmin';
  if (e.type === 'dead-letter' || e.type === 'drop') v.reason = t.events.reasons[e.reason];
  if (e.type === 'requeue') v.reason = t.events.requeueReasons[e.reason];
  if (e.type === 'declare' || e.type === 'delete') v.kind = t.events.kinds[e.kind];
  return v;
}
