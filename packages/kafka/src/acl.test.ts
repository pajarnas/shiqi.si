import { describe, expect, it } from 'vitest';
import { authorize, type Acl } from './acl';
import { runCli } from './cli';
import { Cluster } from './cluster';

const allow = (
  principal: string,
  resource: Acl['resource'],
  name: string,
  operation: Acl['operation'],
): Acl => ({
  principal,
  resource,
  name,
  pattern: 'literal',
  operation,
  permission: 'Allow',
});

function secured() {
  const c = new Cluster({ brokers: 3, seed: 11 });
  c.createTopic('orders', { partitions: 2, replicationFactor: 3 });
  c.addProducer({ id: 'checkout', topic: 'orders', rate: 10, acks: 1, keys: 'fixed' });
  c.addConsumer({ group: 'billing', topics: ['orders'], clientId: 'billing-1', rate: 50 });
  c.tick(3000);
  return c;
}
const run = (c: Cluster, ms: number) => {
  for (let t = 0; t < ms; t += 50) c.tick(50);
};
const member = (c: Cluster) => [...c.group('billing').members.values()][0]!;

describe('authorizer', () => {
  it('needs a matching Allow and no matching Deny; Read implies Describe', () => {
    const acls = [allow('User:a', 'topic', 'orders', 'Read')];
    expect(authorize(acls, 'User:a', 'topic', 'orders', 'Read')).toBe(true);
    expect(authorize(acls, 'User:a', 'topic', 'orders', 'Describe')).toBe(true);
    expect(authorize(acls, 'User:a', 'topic', 'orders', 'Write')).toBe(false);
    expect(authorize(acls, 'User:b', 'topic', 'orders', 'Read')).toBe(false);
    const denied = [...acls, { ...acls[0]!, principal: 'User:*', permission: 'Deny' as const }];
    expect(authorize(denied, 'User:a', 'topic', 'orders', 'Read')).toBe(false);
    const prefixed = [{ ...acls[0]!, name: 'ord', pattern: 'prefixed' as const }];
    expect(authorize(prefixed, 'User:a', 'topic', 'orders', 'Read')).toBe(true);
    expect(authorize([], 'User:admin', 'topic', 'orders', 'Write')).toBe(true);
  });

  it('refuses everyone once switched on, then lets each permission through as it is granted', () => {
    const c = secured();
    const pr = c.producers.get('checkout')!;
    expect(member(c).assignment.length).toBe(2);

    runCli(c, 'authorizer on');
    run(c, 4000);
    expect(pr.lastError).toBe('TOPIC_AUTHORIZATION_FAILED');
    expect(member(c).error).toBe('GROUP_AUTHORIZATION_FAILED');
    expect(member(c).assignment).toEqual([]);
    expect(c.events.some((e) => e.type === 'auth-denied' && e.resource === 'group')).toBe(true);

    runCli(c, 'kafka-acls --add --allow-principal User:billing-1 --operation Read --group billing');
    run(c, 4000);
    expect(member(c).assignment.length).toBe(2);
    expect(member(c).error).toBe('TOPIC_AUTHORIZATION_FAILED');

    runCli(c, 'kafka-acls --add --allow-principal User:billing-1 --operation Read --topic orders');
    runCli(c, 'kafka-acls --add --allow-principal User:checkout --operation Write --topic orders');
    const acked = pr.acked;
    const consumed = member(c).consumed;
    run(c, 4000);
    expect(member(c).error).toBeUndefined();
    expect(pr.acked).toBeGreaterThan(acked);
    expect(member(c).consumed).toBeGreaterThan(consumed);
    expect(runCli(c, 'kafka-acls --list --topic orders').lines.join('\n')).toContain(
      'principal=User:checkout',
    );
  });
});
