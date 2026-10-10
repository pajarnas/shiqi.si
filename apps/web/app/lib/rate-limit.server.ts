/**
 * A fixed-window request counter per key (usually the client IP), in process
 * memory: fine for one web container. `take` returns false once a key has used
 * `limit` requests in the current window.
 */
export function rateLimiter(limit: number, windowMs: number, now = Date.now) {
  const MAX_KEYS = 10_000;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    take(key: string): boolean {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        if (windows.size >= MAX_KEYS) windows.delete(windows.keys().next().value as string);
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      w.count += 1;
      return w.count <= limit;
    },
  };
}
