/** 1536 -> '1.5 KB'. */
export function bytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Simulated ms as m:ss. */
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Simulated ms as m:ss.cc, for events a step apart. */
export function preciseClock(ms: number): string {
  const cs = Math.floor(ms / 10);
  return `${clock(ms)}.${String(cs % 100).padStart(2, '0')}`;
}
