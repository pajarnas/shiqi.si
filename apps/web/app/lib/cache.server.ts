// A tiny string cache: Redis when it's there, a bounded in-process map when it isn't.
import { getRedis } from './redis.server';

const MEMORY_LIMIT = 5000;
const memory = new Map<string, { value: string; expires: number }>();

export async function cacheGet(keys: string[]): Promise<(string | null)[]> {
  if (!keys.length) return [];
  const redis = await getRedis();
  if (redis) {
    try {
      return await redis.mGet(keys);
    } catch (err) {
      console.error('[cache] read failed', err);
    }
  }
  const now = Date.now();
  return keys.map((k) => {
    const hit = memory.get(k);
    return hit && hit.expires > now ? hit.value : null;
  });
}

export async function cacheSet(entries: [string, string][], ttlSeconds: number): Promise<void> {
  if (!entries.length) return;
  const redis = await getRedis();
  if (redis) {
    try {
      const multi = redis.multi();
      for (const [k, v] of entries)
        multi.set(k, v, { expiration: { type: 'EX', value: ttlSeconds } });
      await multi.exec();
      return;
    } catch (err) {
      console.error('[cache] write failed', err);
    }
  }
  const expires = Date.now() + ttlSeconds * 1000;
  for (const [k, v] of entries) {
    if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value as string);
    memory.set(k, { value: v, expires });
  }
}
