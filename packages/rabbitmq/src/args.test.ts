import { describe, expect, it } from 'vitest';
import { queueArgsFrom } from './args';
import { QUEUE_DEFAULTS } from './types';

describe('queueArgsFrom', () => {
  it('reads what the management API reports', () => {
    expect(
      queueArgsFrom(
        { 'x-dead-letter-exchange': 'lab.dlx', 'x-delivery-limit': 5, 'x-queue-type': 'quorum' },
        'quorum',
      ),
    ).toEqual({
      ...QUEUE_DEFAULTS,
      type: 'quorum',
      deadLetterExchange: 'lab.dlx',
      deliveryLimit: 5,
    });
  });

  it('ignores what it does not know', () => {
    expect(queueArgsFrom({ 'x-max-priority': 10, 'x-max-length': 'lots' }, 'stream')).toEqual(
      QUEUE_DEFAULTS,
    );
  });
});
