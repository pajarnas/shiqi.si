// One shared Redis connection for the server, opened on first use.
// Resolves to null when REDIS_URL is unset or Redis can't be reached, so
// callers fall back instead of failing the page. With the offline queue off,
// commands fail fast while Redis is down instead of piling up.
import { createClient } from 'redis';

const connect = (url: string) =>
  createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 1000, reconnectStrategy: (n) => Math.min(n * 500, 5000) },
  });

export type Redis = ReturnType<typeof connect>;

/** Rejects if `promise` takes longer than `ms`, so a dead Redis can't stall a page. */
export function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms).unref()),
  ]);
}

let client: Promise<Redis | null> | undefined;

export function getRedis(): Promise<Redis | null> {
  const url = process.env.REDIS_URL;
  if (!url) return Promise.resolve(null);
  client ??= (async () => {
    const c = connect(url);
    c.on('error', (err: unknown) => console.warn('[redis]', err));
    const ready = c.connect();
    ready.catch(() => {});
    try {
      await within(ready, 2000);
      return c;
    } catch (err) {
      console.warn('[redis] unavailable:', err);
      c.destroy();
      client = undefined;
      return null;
    }
  })();
  return client;
}
