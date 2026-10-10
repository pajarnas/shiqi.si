import { describe, expect, it } from 'vitest';
import { runCli, table, tokenize } from './cli';
import { Cluster } from './cluster';

const sh = (c: Cluster, line: string) => runCli(c, line).lines;

describe('CLI', () => {
  it('tokenizes like a shell', () => {
    expect(tokenize(`kafka-topics --config 'a=b c' "" x`)).toEqual([
      'kafka-topics',
      '--config',
      'a=b c',
      '',
      'x',
    ]);
  });

  it('creates, lists, describes, alters and deletes topics', () => {
    const c = new Cluster({ brokers: 3 });
    expect(
      sh(
        c,
        'bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 2 --replication-factor 2 --config retention.ms=60000',
      ),
    ).toEqual(['Created topic orders.']);
    expect(sh(c, 'kafka-topics --list')).toEqual(['orders']);
    const desc = sh(c, 'kafka-topics --describe --topic orders');
    expect(desc[0]).toMatch(
      /^Topic: orders\tTopicId: \S{22}\tPartitionCount: 2\tReplicationFactor: 2\tConfigs: retention.ms=60000$/,
    );
    expect(desc[1]).toMatch(
      /^\tTopic: orders\tPartition: 0\tLeader: \d\tReplicas: \d,\d\tIsr: \d,\d/,
    );
    expect(sh(c, 'kafka-topics --create --topic orders')[0]).toBe(
      "Error while executing topic command : Topic 'orders' already exists.",
    );
    sh(c, 'kafka-topics --alter --topic orders --partitions 4');
    expect(c.topic('orders').partitions).toHaveLength(4);
    expect(
      sh(
        c,
        'kafka-configs --entity-type topics --entity-name orders --alter --add-config cleanup.policy=compact',
      ),
    ).toEqual(['Completed updating config for topic orders.']);
    expect(sh(c, 'kafka-configs --entity-type topics --entity-name orders --describe')).toContain(
      '  cleanup.policy=compact sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:cleanup.policy=compact}',
    );
    sh(c, 'kafka-topics --delete --topic orders');
    expect(c.topics.size).toBe(0);
  });

  it('produces with keys and consumes from the beginning', () => {
    const c = new Cluster({ brokers: 1 });
    sh(c, 'kafka-topics --create --topic t --partitions 1 --replication-factor 1');
    const prod = runCli(
      c,
      'kafka-console-producer --topic t --property parse.key=true --property key.separator=:',
    ).session!;
    expect(prod.prompt).toBe('>');
    prod.input('alice:hello');
    prod.input('bob:world');
    expect(prod.input('nokey')[0]).toMatch(/No key separator/);
    prod.close();

    const cons = runCli(
      c,
      'kafka-console-consumer --topic t --from-beginning --max-messages 2 --property print.key=true --property print.offset=true',
    ).session!;
    expect(c.groups.size).toBe(1);
    const out: string[] = [];
    for (let i = 0; i < 40 && !cons.done; i++) {
      c.tick(100);
      out.push(...cons.poll());
    }
    expect(out).toEqual([
      'Offset:0\talice\thello',
      'Offset:1\tbob\tworld',
      'Processed a total of 2 messages',
    ]);
    expect(c.groups.size).toBe(0);
  });

  it('describes and resets consumer groups', () => {
    const c = new Cluster({ brokers: 1 });
    sh(c, 'kafka-topics --create --topic t --partitions 2 --replication-factor 1');
    for (let i = 0; i < 6; i++) c.produce({ topic: 't', key: `k${i}`, value: 'v' });
    const m = c.addConsumer({ group: 'g', topics: ['t'], offsetReset: 'earliest', rate: 1000 });
    for (let i = 0; i < 60; i++) c.tick(100); // past the first auto-commit
    const desc = sh(c, 'kafka-consumer-groups --describe --group g');
    expect(desc[1]).toMatch(
      /^GROUP\s+TOPIC\s+PARTITION\s+CURRENT-OFFSET\s+LOG-END-OFFSET\s+LAG\s+CONSUMER-ID/,
    );
    expect(desc.slice(2).every((l) => /\s0\s+consumer-g-1-/.test(l))).toBe(true);
    expect(
      sh(c, 'kafka-consumer-groups --reset-offsets --group g --topic t --to-earliest --execute')[0],
    ).toMatch(/inactive/);
    c.removeConsumer('g', m.id);
    const reset = sh(
      c,
      'kafka-consumer-groups --reset-offsets --group g --topic t:0 --to-earliest --execute',
    );
    expect(reset.at(-1)).toMatch(/^g\s+t\s+0\s+0$/);
    expect(sh(c, 'kafka-consumer-groups --list')).toEqual(['g']);
    expect(sh(c, 'kafka-consumer-groups --delete --group g')[0]).toMatch(/successful/);
  });

  it('runs simulator broker commands and reports unknown ones', () => {
    const c = new Cluster({ brokers: 3 });
    sh(c, 'kafka-topics --create --topic t --partitions 3 --replication-factor 3');
    sh(c, 'broker stop 1');
    expect(c.brokers.get(1)?.up).toBe(false);
    expect(sh(c, 'kafka-topics --describe --under-replicated-partitions')).toHaveLength(3);
    sh(c, 'broker start 1');
    for (let i = 0; i < 20; i++) c.tick(100);
    expect(
      sh(c, 'kafka-leader-election --election-type preferred --all-topic-partitions')[0],
    ).toMatch(/Successfully|Valid/);
    expect(sh(c, 'nope')[0]).toMatch(/command not found/);
    expect(runCli(c, 'clear').clear).toBe(true);
  });

  it('pads tables', () => {
    expect(table(['A', 'LONGER'], [['xyz', undefined]])).toEqual(['A   LONGER', 'xyz -']);
  });
});
