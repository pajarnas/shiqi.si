import { describe, expect, it } from 'vitest';
import { Cluster } from './cluster';

function busy() {
  const c = new Cluster({ brokers: 3, seed: 3 });
  c.createTopic('orders', { partitions: 3, replicationFactor: 3 });
  c.addProducer({ id: 'p', topic: 'orders', rate: 10, acks: 1, keys: 'fixed' });
  for (let i = 0; i < 20; i++) c.tick(50);
  return c;
}

const sends = (c: Cluster, since: number) =>
  c.events.filter((e) => e.at > since && (e.type === 'produce' || e.type === 'ack')).length;

describe('a producer with nowhere to send', () => {
  it('buffers instead of sending while every broker is down, then catches up', () => {
    const c = busy();
    for (const id of [1, 2, 3]) c.stopBroker(id, { hard: true });
    const off = c.now;
    for (let i = 0; i < 100; i++) c.tick(50); // 5 s
    const p = c.producers.get('p')!;
    expect(sends(c, off)).toBe(0);
    expect(p.buffered.length).toBeGreaterThan(30);
    expect(p.failed).toBe(0);

    for (const id of [1, 2, 3]) c.startBroker(id);
    for (let i = 0; i < 100; i++) c.tick(50);
    expect(p.buffered).toHaveLength(0);
    expect(p.failed).toBe(0);
  });

  it('fails buffered records with a timeout after delivery.timeout.ms', () => {
    const c = busy();
    for (const id of [1, 2, 3]) c.stopBroker(id, { hard: true });
    const ticks = c.settings.deliveryTimeoutMs / 50 + 20;
    for (let i = 0; i < ticks; i++) c.tick(50);
    const p = c.producers.get('p')!;
    expect(p.failed).toBeGreaterThan(0);
    expect(p.lastError).toBe('REQUEST_TIMED_OUT');
    expect(p.buffered.every((r) => c.now - r.at < c.settings.deliveryTimeoutMs)).toBe(true);
  });
});
