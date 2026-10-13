// Queue arguments as a real RabbitMQ reports them (the management API's
// `arguments` object), read leniently: unknown keys are ignored, odd values
// fall back to the defaults. The CLI emulator has its own strict reader.
import { QUEUE_DEFAULTS, type QueueArgs } from './types';

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** `queueType` is the queue's own `type` field, which wins over x-queue-type. */
export function queueArgsFrom(raw: Record<string, unknown>, queueType?: string): QueueArgs {
  const type = queueType ?? raw['x-queue-type'];
  const overflow = raw['x-overflow'];
  return {
    ...QUEUE_DEFAULTS,
    type: type === 'quorum' ? 'quorum' : 'classic',
    messageTtl: num(raw['x-message-ttl']),
    maxLength: num(raw['x-max-length']),
    overflow: overflow === 'reject-publish' ? 'reject-publish' : 'drop-head',
    deadLetterExchange: str(raw['x-dead-letter-exchange']),
    deadLetterRoutingKey: str(raw['x-dead-letter-routing-key']),
    deliveryLimit: num(raw['x-delivery-limit']),
    singleActiveConsumer: raw['x-single-active-consumer'] === true,
  };
}
