// Visitor log storage in Redis. Recording never throws and never makes a page
// wait: if Redis is missing or slow, the view simply isn't logged.
import { createClient } from 'redis';
import { LOG_SIZE, parseVisit, type Visit } from './visits';

const LOG = 'visits:log';
const TOTALS = 'visits:totals';

const connect = (url: string) =>
  createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 1000, reconnectStrategy: (n) => Math.min(n * 500, 5000) },
  });

type Client = ReturnType<typeof connect>;

/** Rejects if `promise` takes longer than `ms`, so a dead Redis can't stall a page. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms).unref()),
  ]);
}
let client: Promise<Client | null> | undefined;

function redis(): Promise<Client | null> {
  const url = process.env.REDIS_URL;
  if (!url) return Promise.resolve(null);
  client ??= (async () => {
    const c = connect(url);
    c.on('error', (err: unknown) => console.warn('[visits] redis:', err));
    const ready = c.connect();
    ready.catch(() => {});
    try {
      await within(ready, 2000);
      return c;
    } catch (err) {
      console.warn('[visits] redis unavailable:', err);
      c.destroy();
      client = undefined;
      return null;
    }
  })();
  return client;
}

export async function recordVisit(visit: Visit): Promise<void> {
  try {
    const r = await redis();
    if (!r) return;
    const tx = r
      .multi()
      .lPush(LOG, JSON.stringify(visit))
      .lTrim(LOG, 0, LOG_SIZE - 1);
    if (!visit.bot) tx.hIncrBy(TOTALS, visit.path, 1);
    await within(tx.exec(), 2000);
  } catch (err) {
    console.warn('[visits] record failed:', err);
  }
}

export interface VisitLog {
  available: boolean;
  visits: Visit[];
  totals: Record<string, string>;
}

/** The newest `limit` visits plus all-time view counts per page. */
export async function readVisits(limit = LOG_SIZE): Promise<VisitLog> {
  const r = await redis();
  if (!r) return { available: false, visits: [], totals: {} };
  const [raw, totals] = await within(
    Promise.all([r.lRange(LOG, 0, limit - 1), r.hGetAll(TOTALS)]),
    5000,
  );
  const visits = raw.map(parseVisit).filter((v): v is Visit => v !== null);
  return { available: true, visits, totals };
}
