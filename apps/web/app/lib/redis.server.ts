// One shared Redis connection for the server, opened on first use.
// Returns null when REDIS_URL is unset or Redis can't be reached, so callers
// can fall back instead of failing the page.
import { createClient } from 'redis';

const connect = (url: string) =>
  createClient({
    url,
    socket: { connectTimeout: 2000, reconnectStrategy: (n) => Math.min(n * 200, 5000) },
  });

export type Redis = ReturnType<typeof connect>;

let pending: Promise<Redis | null> | null = null;
let retryAt = 0;

export function getRedis(): Promise<Redis | null> {
  const url = process.env.REDIS_URL;
  if (!url) return Promise.resolve(null);
  if (pending) return pending;
  if (Date.now() < retryAt) return Promise.resolve(null);
  const attempt = (async () => {
    const client = connect(url);
    client.on('error', (err: unknown) => console.error('[redis]', err));
    try {
      await client.connect();
      return client;
    } catch (err) {
      console.error('[redis] connect failed', err);
      pending = null;
      retryAt = Date.now() + 30_000;
      client.destroy();
      return null;
    }
  })();
  pending = attempt;
  return attempt;
}
