import { describe, expect, it } from 'vitest';
import { getRabbit, readSnapshot, type RabbitPort } from './client.server';
import { toSnapshot } from './snapshot';

// Trimmed from what RabbitMQ 4.3's management API answered for the lab topology.
const RAW = {
  '/api/overview': {
    rabbitmq_version: '4.3.5',
    object_totals: { channels: 0, consumers: 0, exchanges: 9, queues: 2, connections: 1 },
  },
  '/api/nodes': [
    {
      name: 'rabbit@rabbitmq',
      mem_used: 151240704,
      mem_limit: 192000000,
      mem_alarm: false,
      disk_free_alarm: false,
      uptime: 35826,
    },
  ],
  '/api/queues': [
    {
      name: 'lab.shipping',
      type: 'classic',
      state: 'running',
      messages_ready: 0,
      messages_unacknowledged: 0,
      consumers: 0,
      arguments: { 'x-dead-letter-exchange': 'lab.dlx', 'x-queue-type': 'classic' },
    },
    {
      name: 'lab.billing',
      type: 'quorum',
      state: 'running',
      messages_ready: 3,
      messages_unacknowledged: 1,
      consumers: 2,
      message_stats: { publish: 4, publish_details: { rate: 0.6 }, ack_details: { rate: 0.2 } },
      arguments: {
        'x-dead-letter-exchange': 'lab.dlx',
        'x-delivery-limit': 5,
        'x-queue-type': 'quorum',
      },
    },
  ],
  '/api/exchanges': [
    { name: '', type: 'direct' },
    { name: 'amq.topic', type: 'topic' },
    {
      name: 'lab.orders',
      type: 'topic',
      message_stats: { publish_in_details: { rate: 0.6 }, publish_out_details: { rate: 1.2 } },
    },
  ],
  '/api/bindings': [
    {
      source: '',
      destination: 'lab.billing',
      destination_type: 'queue',
      routing_key: 'lab.billing',
    },
    {
      source: 'lab.orders',
      destination: 'lab.billing',
      destination_type: 'queue',
      routing_key: 'order.created',
    },
  ],
} as Record<string, unknown>;

const fake: RabbitPort = { get: (path) => Promise.resolve(RAW[path]) };

describe('the real RabbitMQ snapshot', () => {
  it('reads queues, exchanges and bindings from the management API', async () => {
    const s = await readSnapshot(fake, () => 1000);
    expect(s.at).toBe(1000);
    expect(s.version).toBe('4.3.5');
    expect(s.node).toMatchObject({ memUsed: 151240704, memLimit: 192000000, alarm: false });
    expect(s.connections).toBe(1);
    expect(s.queues.map((q) => q.name)).toEqual(['lab.billing', 'lab.shipping']);
    expect(s.queues[0]).toMatchObject({
      type: 'quorum',
      ready: 3,
      unacked: 1,
      consumers: 2,
      rates: { publish: 0.6, deliver: 0, ack: 0.2, redeliver: 0 },
    });
    expect(s.queues[0]!.args).toMatchObject({ deliveryLimit: 5, deadLetterExchange: 'lab.dlx' });
    // Built-in exchanges and the default exchange's own bindings are left out.
    expect(s.exchanges).toEqual([
      { name: 'lab.orders', type: 'topic', rates: { in: 0.6, out: 1.2 } },
    ]);
    expect(s.bindings).toEqual([
      {
        source: 'lab.orders',
        destination: 'lab.billing',
        destinationType: 'queue',
        routingKey: 'order.created',
      },
    ]);
  });

  it('copes with an empty or odd answer', () => {
    const s = toSnapshot({ overview: {}, nodes: [], queues: [{}], exchanges: [], bindings: [] }, 0);
    expect(s.queues[0]).toMatchObject({ name: '', type: 'classic', ready: 0 });
    expect(s.node.alarm).toBe(false);
  });

  it('has no broker without RABBITMQ_API', () => {
    expect(getRabbit({})).toBeNull();
    expect(getRabbit({ RABBITMQ_API: 'http://rabbitmq:15672/' })).not.toBeNull();
  });
});
