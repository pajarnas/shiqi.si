import { describe, expect, it } from 'vitest';
import { runCli, tokenize } from './cli';
import { Cluster } from './cluster';
import { COMMAND_SPECS, commandLine, commandSpec, fieldShown, shellQuote } from './commands';

/** A small busy cluster with one empty group, so every command has something to act on. */
function cluster() {
  const c = new Cluster({ brokers: 3, seed: 7 });
  c.createTopic('orders', { partitions: 3, replicationFactor: 3 });
  c.addProducer({ id: 'p', topic: 'orders', rate: 5, acks: 'all', keys: 'fixed' });
  for (let i = 0; i < 40; i++) c.tick(100);
  c.commitOffsets('audit', [{ topic: 'orders', partition: 0, offset: 1 }]);
  return c;
}

const FAILURE = /error|exception|missing|usage|invalid|not found|must include/i;

describe('command builder', () => {
  it.each(COMMAND_SPECS.map((s) => [s.id, s] as const))(
    '%s, with its defaults, is a command the CLI runs',
    (_, spec) => {
      const c = cluster();
      const line = commandLine(spec.build(spec.defaults(c)));
      const out = runCli(c, line).lines.join('\n');
      expect(out).not.toMatch(FAILURE);
    },
  );

  it('round-trips every value through the shell tokenizer', () => {
    const spec = commandSpec('topicConfig')!;
    const line = commandLine(
      spec.build({ topic: 'my topic', configKey: 'cleanup.policy', configValue: "it's" }),
    );
    expect(tokenize(line)).toContain('my topic');
    expect(tokenize(line)).toContain("cleanup.policy=it's");
    expect(shellQuote('plain')).toBe('plain');
  });

  it('a group seek moves committed offsets only with --execute', () => {
    const c = cluster();
    const spec = commandSpec('groupSeek')!;
    const v = {
      ...spec.defaults(c),
      group: 'audit',
      topic: 'orders',
      partition: 0,
      to: 'offset',
      amount: 3,
    };
    runCli(c, commandLine(spec.build(v)));
    expect(c.groups.get('audit')!.committed.get('orders-0')).toBe(1);
    runCli(c, commandLine(spec.build({ ...v, mode: 'execute' })));
    expect(c.groups.get('audit')!.committed.get('orders-0')).toBe(3);
  });

  it('tags each token with the field that wrote it, and hides fields that do not apply', () => {
    const spec = commandSpec('groupSeek')!;
    const tokens = spec.build({
      group: 'g',
      topic: 't',
      partition: '',
      to: 'shift',
      amount: -2,
      mode: 'execute',
    });
    expect(tokens.filter((t) => t.field === 'amount').map((t) => t.text)).toEqual([
      '--shift-by',
      '-2',
    ]);
    const amount = spec.fields.find((f) => f.id === 'amount')!;
    expect(fieldShown(amount, { to: 'earliest' })).toBe(false);
    expect(fieldShown(amount, { to: 'offset' })).toBe(true);
  });
});
