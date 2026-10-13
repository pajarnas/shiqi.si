import { describe, expect, it } from 'vitest';
import { Broker } from './broker';
import { BrokerTimeline } from './timeline';
import type { BrokerEvent } from './types';

const types = (b: Broker) => b.events.map((e) => e.type);

function hello() {
  const b = new Broker();
  b.declareQueue('hello');
  return b;
}

describe('the default exchange', () => {
  it('routes by queue name, delivers and acks across the network', () => {
    const b = hello();
    b.addConsumer({ queue: 'hello', tag: 'c1', workMs: 200 });
    b.publish({ exchange: '', routingKey: 'hello', body: 'Hello World!' });
    expect(b.queue('hello').ready.length).toBe(0); // still on the wire
    b.tick(300);
    expect(types(b)).toEqual(['declare', 'publish', 'route', 'deliver']);
    expect(b.queue('hello').unacked).toBe(1);
    b.tick(300 + 200 + 300);
    expect(types(b).slice(4)).toEqual(['process', 'ack']);
    expect(b.queue('hello').unacked).toBe(0);
    expect(b.queue('hello').stats.acked).toBe(1);
  });

  it('drops a message for a queue that does not exist, or returns it if mandatory', () => {
    const b = new Broker();
    b.publish({ exchange: '', routingKey: 'nope' });
    b.publish({ exchange: '', routingKey: 'nope', mandatory: true });
    b.tick(400);
    const out = b.events.filter((e) => e.type === 'unroutable');
    expect(out.map((e) => e.type === 'unroutable' && e.outcome)).toEqual(['dropped', 'returned']);
  });
});

describe('work queues', () => {
  it('round-robins between consumers', () => {
    const b = hello();
    b.addConsumer({ queue: 'hello', tag: 'a', prefetch: 1, workMs: 100 });
    b.addConsumer({ queue: 'hello', tag: 'b', prefetch: 1, workMs: 100 });
    for (let i = 0; i < 4; i++) b.publish({ exchange: '', routingKey: 'hello' });
    b.tick(5000);
    expect(b.consumer('a').stats.acked).toBe(2);
    expect(b.consumer('b').stats.acked).toBe(2);
  });

  it('with prefetch 1 the fast worker takes more; without it the slow one hoards', () => {
    const run = (prefetch: number) => {
      const b = hello();
      b.addConsumer({ queue: 'hello', tag: 'slow', prefetch, workMs: 2000 });
      b.addConsumer({ queue: 'hello', tag: 'fast', prefetch, workMs: 100 });
      for (let i = 0; i < 10; i++) b.publish({ exchange: '', routingKey: 'hello' });
      b.tick(400);
      return b;
    };
    const fair = run(1);
    fair.tick(4000);
    expect(fair.consumer('fast').stats.received).toBeGreaterThan(5);
    const greedy = run(0);
    expect(greedy.consumer('slow').stats.received).toBe(5);
    expect(greedy.consumer('fast').stats.received).toBe(5);
  });

  it('requeues what a crashed consumer had not acked, marked redelivered', () => {
    const b = hello();
    b.addConsumer({ queue: 'hello', tag: 'a', prefetch: 3, workMs: 1000 });
    for (let i = 0; i < 3; i++) b.publish({ exchange: '', routingKey: 'hello' });
    b.tick(700);
    expect(b.queue('hello').unacked).toBe(3);
    b.crashConsumer('a');
    const q = b.queue('hello');
    expect(q.unacked).toBe(0);
    expect(q.ready.map((m) => m.id)).toEqual([1, 2, 3]);
    expect(q.ready.every((m) => m.redelivered)).toBe(true);
    b.addConsumer({ queue: 'hello', tag: 'b', prefetch: 1, workMs: 10 });
    b.tick(400);
    const d = b.events.find((e) => e.type === 'deliver' && e.consumer === 'b');
    expect(d && d.type === 'deliver' && d.redelivered).toBe(true);
  });

  it('loses what an auto-ack consumer held when it crashes', () => {
    const b = hello();
    b.addConsumer({ queue: 'hello', tag: 'a', autoAck: true, workMs: 1000 });
    for (let i = 0; i < 3; i++) b.publish({ exchange: '', routingKey: 'hello' });
    b.tick(700);
    b.crashConsumer('a');
    expect(b.queue('hello').ready.length).toBe(0);
    expect(b.consumer('a').stats.lost).toBe(3);
  });

  it('an ack lost with the connection means the message comes again', () => {
    const b = hello();
    b.addConsumer({ queue: 'hello', tag: 'a', prefetch: 1, workMs: 100 });
    b.publish({ exchange: '', routingKey: 'hello' });
    b.tick(300 + 300 + 100 + 50); // processed, ack on the wire
    expect(b.settlingFrom('a')).toBe(1);
    b.crashConsumer('a');
    expect(b.queue('hello').ready[0]?.redelivered).toBe(true);
  });
});

describe('exchanges', () => {
  function logs(type: 'fanout' | 'direct' | 'topic') {
    const b = new Broker({ netMs: 0, tickMs: 10 });
    b.declareExchange('logs', type);
    b.declareQueue('q1');
    b.declareQueue('q2');
    return b;
  }

  it('fanout copies to every bound queue', () => {
    const b = logs('fanout');
    b.bind({ source: 'logs', destination: 'q1' });
    b.bind({ source: 'logs', destination: 'q2' });
    b.publish({ exchange: 'logs', routingKey: 'ignored' });
    b.tick(10);
    expect(b.queue('q1').ready.length).toBe(1);
    expect(b.queue('q2').ready.length).toBe(1);
  });

  it('direct sends by exact key, to every queue bound with it', () => {
    const b = logs('direct');
    b.bind({ source: 'logs', destination: 'q1', routingKey: 'error' });
    b.bind({ source: 'logs', destination: 'q2', routingKey: 'error' });
    b.bind({ source: 'logs', destination: 'q2', routingKey: 'info' });
    b.publish({ exchange: 'logs', routingKey: 'info' });
    b.publish({ exchange: 'logs', routingKey: 'error' });
    b.publish({ exchange: 'logs', routingKey: 'debug' });
    b.tick(10);
    expect(b.queue('q1').ready.length).toBe(1);
    expect(b.queue('q2').ready.length).toBe(2);
    expect(b.exchange('logs').stats.unroutable).toBe(1);
  });

  it('a message matching two bindings to one queue arrives once', () => {
    const b = logs('topic');
    b.bind({ source: 'logs', destination: 'q1', routingKey: '*.orange.*' });
    b.bind({ source: 'logs', destination: 'q1', routingKey: '*.*.rabbit' });
    b.publish({ exchange: 'logs', routingKey: 'quick.orange.rabbit' });
    b.tick(10);
    expect(b.queue('q1').ready.length).toBe(1);
  });

  it('sends unroutable messages to the alternate exchange', () => {
    const b = new Broker({ netMs: 0, tickMs: 10 });
    b.declareExchange('ae', 'fanout');
    b.declareQueue('unrouted');
    b.bind({ source: 'ae', destination: 'unrouted' });
    b.declareExchange('orders', 'direct', { alternate: 'ae' });
    b.publish({ exchange: 'orders', routingKey: 'nobody' });
    b.tick(10);
    expect(b.queue('unrouted').ready.length).toBe(1);
  });

  it('refuses to redeclare with another type, and protects amq.*', () => {
    const b = logs('fanout');
    expect(() => b.declareExchange('logs', 'direct')).toThrow(/inequivalent/);
    expect(() => b.deleteExchange('amq.topic')).toThrow(/not permitted/);
    expect(() => b.bind({ source: '', destination: 'q1' })).toThrow(/default exchange/);
  });
});

describe('dead letters, TTL and length limits', () => {
  function withDlx() {
    const b = new Broker({ netMs: 0, tickMs: 10 });
    b.declareExchange('dlx', 'fanout');
    b.declareQueue('dead');
    b.bind({ source: 'dlx', destination: 'dead' });
    return b;
  }

  it('rejected messages go to the dead-letter exchange with x-death', () => {
    const b = withDlx();
    b.declareQueue('work', { args: { deadLetterExchange: 'dlx' } });
    b.addConsumer({
      queue: 'work',
      tag: 'c',
      prefetch: 1,
      workMs: 10,
      failEvery: 1,
      onFail: 'reject',
    });
    b.publish({ exchange: '', routingKey: 'work' });
    b.tick(100);
    const m = b.queue('dead').ready[0];
    expect(m?.deaths[0]).toMatchObject({ queue: 'work', reason: 'rejected', count: 1 });
  });

  it('a nack with requeue comes back again and again until the delivery limit', () => {
    const b = withDlx();
    b.declareQueue('work', {
      args: { type: 'quorum', deliveryLimit: 2, deadLetterExchange: 'dlx' },
    });
    b.addConsumer({ queue: 'work', tag: 'c', prefetch: 1, workMs: 10, failEvery: 1 });
    b.publish({ exchange: '', routingKey: 'work' });
    b.tick(500);
    expect(b.consumer('c').stats.nacked).toBe(3);
    expect(b.queue('dead').ready[0]?.deaths[0]?.reason).toBe('delivery_limit');
  });

  it('expires messages at the head after x-message-ttl', () => {
    const b = withDlx();
    b.declareQueue('wait', { args: { messageTtl: 1000, deadLetterExchange: 'dlx' } });
    b.publish({ exchange: '', routingKey: 'wait' });
    b.tick(990);
    expect(b.queue('wait').ready.length).toBe(1);
    b.tick(20);
    expect(b.queue('wait').ready.length).toBe(0);
    expect(b.queue('dead').ready[0]?.deaths[0]?.reason).toBe('expired');
  });

  it('drop-head pushes the oldest out; reject-publish refuses the newest and nacks it', () => {
    const b = withDlx();
    b.declareQueue('small', { args: { maxLength: 2, deadLetterExchange: 'dlx' } });
    for (let i = 0; i < 3; i++) b.publish({ exchange: '', routingKey: 'small', body: `m${i}` });
    b.tick(10);
    expect(b.queue('small').ready.map((m) => m.body)).toEqual(['m1', 'm2']);
    expect(b.queue('dead').ready[0]?.body).toBe('m0');

    b.declareQueue('strict', { args: { maxLength: 1, overflow: 'reject-publish' } });
    b.addPublisher({ id: 'p', exchange: '', keys: ['strict'], rate: 0, confirm: true });
    b.publishFrom('p');
    b.publishFrom('p');
    b.tick(10);
    expect(b.queue('strict').ready.length).toBe(1);
    expect(b.publisher('p').stats).toMatchObject({ confirmed: 1, nacked: 1 });
  });
});

describe('single active consumer', () => {
  it('only the first consumer gets messages; the next takes over when it goes', () => {
    const b = new Broker({ netMs: 0, tickMs: 10 });
    b.declareQueue('sac', { args: { singleActiveConsumer: true } });
    b.addConsumer({ queue: 'sac', tag: 'a', prefetch: 1, workMs: 10 });
    b.addConsumer({ queue: 'sac', tag: 'b', prefetch: 1, workMs: 10 });
    for (let i = 0; i < 3; i++) b.publish({ exchange: '', routingKey: 'sac' });
    b.tick(200);
    expect(b.consumer('a').stats.acked).toBe(3);
    expect(b.consumer('b').stats.acked).toBe(0);
    b.removeConsumer('a');
    b.publish({ exchange: '', routingKey: 'sac' });
    b.tick(100);
    expect(b.consumer('b').stats.acked).toBe(1);
  });
});

describe('timeline', () => {
  it('rewinds and replays to the same history', () => {
    const make = () => {
      const b = new Broker();
      b.declareQueue('q');
      b.addConsumer({ queue: 'q', tag: 'c', prefetch: 2, workMs: 400 });
      b.addPublisher({ id: 'p', exchange: '', keys: ['q'], rate: 3 });
      return b;
    };
    const t = new BrokerTimeline(make);
    t.sim.tick(2000);
    t.sim.crashConsumer('c');
    t.sim.tick(1000);
    t.sim.restartConsumer('c');
    t.sim.tick(2000);
    const live: BrokerEvent[] = [...t.sim.events];
    t.seek(500);
    expect(t.rewound).toBe(true);
    t.seek(5000);
    expect(t.sim.events).toEqual(live);
  });
});
