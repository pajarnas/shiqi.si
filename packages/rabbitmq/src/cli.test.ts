import { describe, expect, it } from 'vitest';
import { Broker } from './broker';
import { runRabbitCli } from './cli';

const run = (b: Broker, line: string) => runRabbitCli(b, line).lines;

describe('rabbitmqadmin and rabbitmqctl', () => {
  it('declares, binds, publishes and reads back', () => {
    const b = new Broker({ netMs: 0, tickMs: 10 });
    expect(run(b, 'rabbitmqadmin declare exchange name=logs type=topic')).toEqual([
      'exchange declared',
    ]);
    run(b, `rabbitmqadmin declare queue name=errors arguments='{"x-message-ttl":5000}'`);
    run(b, 'rabbitmqadmin declare binding source=logs destination=errors routing_key=*.error');
    expect(run(b, 'rabbitmqadmin publish exchange=logs routing_key=db.error payload=boom')).toEqual(
      ['Message published'],
    );
    expect(run(b, 'rabbitmqadmin publish exchange=logs routing_key=db.info payload=ok')).toEqual([
      'Message published but NOT routed',
    ]);
    b.tick(10);
    expect(run(b, 'rabbitmqctl list_queues name messages arguments').slice(2)).toEqual([
      'name   messages arguments',
      'errors 1        [{"x-message-ttl",5000}]',
    ]);
    const got = run(b, 'rabbitmqadmin get queue=errors');
    expect(got[1]).toContain('boom');
    expect(b.queue('errors').ready[0]?.redelivered).toBe(true);
    run(b, 'rabbitmqadmin get queue=errors ackmode=ack_requeue_false');
    expect(b.queue('errors').ready.length).toBe(0);
    expect(run(b, 'rabbitmqadmin get queue=errors')).toEqual(['No items']);
  });

  it('lists the implicit default-exchange bindings and reports errors like the server', () => {
    const b = new Broker();
    run(b, 'rabbitmqadmin declare queue name=q');
    expect(run(b, 'rabbitmqctl list_bindings').at(-1)).toMatch(/^\s+exchange\s+q\s+queue\s+q\s+\[\]$/);
    expect(run(b, 'rabbitmqadmin delete queue name=nope')).toEqual([
      "Error: NOT_FOUND - no queue 'nope' in vhost '/'",
    ]);
    expect(run(b, 'rabbitmqadmin declare exchange name=amq.x type=direct')[0]).toMatch(
      /ACCESS_REFUSED/,
    );
    expect(run(b, 'kafka-topics --list')[0]).toMatch(/command not found/);
  });

  it('close_connection crashes a consumer', () => {
    const b = new Broker();
    b.declareQueue('q');
    b.addConsumer({ queue: 'q', tag: 'worker-1' });
    run(b, 'rabbitmqctl close_connection worker-1');
    expect(b.consumer('worker-1').down).toBe(true);
  });
});
