import { EventList } from '@shiqi/lab';
import type { Broker, BrokerEvent } from '@shiqi/rabbitmq';
import { format } from '@shiqi/ui';
import { useRabbitStrings } from '../i18n';
import { eventWords } from '../story';
import type { RabbitStrings } from '../strings';

/** Per-message traffic: there is a lot of it, so it is hidden unless asked for. */
const DATA = new Set<BrokerEvent['type']>(['publish', 'route', 'deliver', 'process', 'ack']);
const isData = (e: BrokerEvent) => DATA.has(e.type) || (e.type === 'confirm' && e.ok);

/** One event as a sentence. */
export function describeEvent(e: BrokerEvent, t: RabbitStrings): string {
  const s = t.events;
  const v = eventWords(e, t);
  switch (e.type) {
    case 'publish':
      return format(s.publish, v);
    case 'route':
      return format(s.route, v);
    case 'unroutable':
      return format(e.outcome === 'returned' ? s.unroutableReturned : s.unroutableDropped, v);
    case 'confirm':
      return format(e.ok ? s.confirmOk : s.confirmNack, v);
    case 'deliver':
      return format(e.redelivered ? s.deliverAgain : s.deliver, v);
    case 'process':
      return format(e.ok ? s.processOk : s.processFail, v);
    case 'ack':
      return format(s.ack, v);
    case 'nack':
      return format(e.requeue ? s.nackRequeue : s.reject, v);
    case 'requeue':
      return format(s.requeue, v);
    case 'dead-letter':
      return format(s.deadLetter, v);
    case 'drop':
      return format(s.drop, v);
    case 'reject-publish':
      return format(s.rejectPublish, v);
    case 'consumer-down':
      return format(s.consumerDown, v);
    case 'consumer-up':
      return format(s.consumerUp, v);
    case 'consumer-cancel':
      return format(s.consumerCancel, v);
    case 'active-consumer':
      return format(s.activeConsumer, v);
    case 'get':
      return format(s.get, v);
    case 'purge':
      return format(s.purge, v);
    case 'declare':
      return format(s.declare, v);
    case 'delete':
      return format(s.delete, v);
  }
}

const tone = (e: BrokerEvent) =>
  e.type === 'drop' ||
  e.type === 'dead-letter' ||
  e.type === 'reject-publish' ||
  e.type === 'consumer-down' ||
  (e.type === 'unroutable' && e.outcome === 'dropped') ||
  (e.type === 'confirm' && !e.ok) ||
  (e.type === 'nack' && !e.requeue)
    ? 'bad'
    : e.type === 'consumer-up'
      ? 'good'
      : undefined;

export function EventLog({ broker }: { broker: Broker }) {
  const t = useRabbitStrings();
  return (
    <EventList
      strings={t.events}
      events={broker.events}
      isData={isData}
      describe={(e) => describeEvent(e, t)}
      tone={tone}
    />
  );
}
