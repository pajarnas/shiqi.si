// The server's view of the real RabbitMQ: its management API (RABBITMQ_API,
// e.g. http://rabbitmq:15672), read with a monitoring-only user. Unset means
// there is no broker and /api/rabbitmq answers 503.
import { toSnapshot, type RabbitSnapshot, type RawManagement } from './snapshot';

export const RABBIT_TIMEOUT_MS = 3000;

export interface RabbitPort {
  /** GET a management API path such as /api/queues; rejects on a non-2xx answer. */
  get(path: string): Promise<unknown>;
}

export function getRabbit(env: NodeJS.ProcessEnv = process.env): RabbitPort | null {
  const base = env.RABBITMQ_API?.replace(/\/+$/, '');
  if (!base) return null;
  const auth = `Basic ${Buffer.from(`${env.RABBITMQ_API_USER ?? ''}:${env.RABBITMQ_API_PASSWORD ?? ''}`).toString('base64')}`;
  return {
    async get(path) {
      const res = await fetch(base + path, {
        headers: { Authorization: auth, Accept: 'application/json' },
        signal: AbortSignal.timeout(RABBIT_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    },
  };
}

const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

export async function readSnapshot(port: RabbitPort, now = Date.now): Promise<RabbitSnapshot> {
  const [overview, nodes, queues, exchanges, bindings] = await Promise.all(
    ['/api/overview', '/api/nodes', '/api/queues', '/api/exchanges', '/api/bindings'].map((p) =>
      port.get(p),
    ),
  );
  const raw: RawManagement = {
    overview: (overview ?? {}) as Record<string, unknown>,
    nodes: list(nodes),
    queues: list(queues),
    exchanges: list(exchanges),
    bindings: list(bindings),
  };
  return toSnapshot(raw, now());
}
