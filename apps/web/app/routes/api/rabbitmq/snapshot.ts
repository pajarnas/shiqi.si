// GET /api/rabbitmq/snapshot — the real broker at a glance: queues with their
// depth and rates, exchanges and bindings, memory. Shared by every visitor for
// a second; 503 { available: false } without a broker.
import { getRabbit, readSnapshot } from '~/features/rabbitmq-real/client.server';
import { json, limitPublic, unavailable } from '~/lib/api.server';
import { cachedFor } from '~/lib/memo.server';

const snapshot = cachedFor(1000, () => {
  const port = getRabbit();
  if (!port) return Promise.reject(new Error('no broker'));
  return readSnapshot(port);
});

export async function loader({ request }: { request: Request }) {
  const limited = limitPublic(request);
  if (limited) return limited;
  if (!getRabbit()) return unavailable();
  try {
    return json(await snapshot(), 200, { 'Cache-Control': 'public, max-age=1' });
  } catch (err) {
    console.warn('[rabbitmq]', err);
    return unavailable();
  }
}
