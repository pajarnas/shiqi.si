// GET /api/kafka/snapshot — the real cluster at a glance: brokers, the active
// controller, topics with partition leaders/ISR/offsets, and consumer groups.
// Shared by every visitor for a second; 503 { available: false } without a cluster.
import { readSnapshot } from '~/features/kafka-real/cluster.server';
import { getKafka } from '~/features/kafka-real/client.server';
import { json, limitPublic, withKafka } from '~/features/kafka-real/http.server';
import { cachedFor } from '~/lib/memo.server';

const snapshot = cachedFor(1000, () => {
  const port = getKafka();
  if (!port) return Promise.reject(new Error('no cluster'));
  return readSnapshot(port);
});

export async function loader({ request }: { request: Request }) {
  return (
    limitPublic(request) ??
    withKafka(async () => json(await snapshot(), 200, { 'Cache-Control': 'public, max-age=1' }))
  );
}
