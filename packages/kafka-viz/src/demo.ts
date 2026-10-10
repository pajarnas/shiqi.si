// The cluster /kafka opens with: three brokers, one replicated topic, two
// producers and two consumer groups, already busy. Deterministic for a seed so
// the server-rendered first frame matches the browser's.
import { Cluster } from '@shiqi/kafka';

export function demoCluster(seed = 1984): Cluster {
  const c = new Cluster({ brokers: 3, seed });
  c.createTopic('orders', {
    partitions: 3,
    replicationFactor: 3,
    config: { 'min.insync.replicas': 2, 'retention.ms': 120_000, 'segment.bytes': 1024 },
  });
  c.createTopic('profiles', {
    partitions: 2,
    replicationFactor: 2,
    config: { 'cleanup.policy': 'compact', 'segment.bytes': 512 },
  });
  c.addProducer({ id: 'checkout', topic: 'orders', rate: 3, acks: 'all', keys: 'fixed' });
  c.addProducer({ id: 'clicks', topic: 'orders', rate: 2, acks: 1, keys: 'none' });
  c.addProducer({ id: 'profile-svc', topic: 'profiles', rate: 1.5, acks: 'all', keys: 'fixed' });
  c.addConsumer({ group: 'billing', topics: ['orders'], clientId: 'billing-1', rate: 3 });
  c.addConsumer({ group: 'billing', topics: ['orders'], clientId: 'billing-2', rate: 3 });
  c.addConsumer({
    group: 'search-index',
    topics: ['orders', 'profiles'],
    clientId: 'indexer',
    rate: 8,
    assignor: 'cooperative-sticky',
    offsetReset: 'earliest',
  });
  return c;
}
