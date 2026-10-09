/** A function returning floats in [0, 1). */
export type Random = () => number;

/** mulberry32: tiny, fast, deterministic PRNG. Same seed, same sequence. */
export function rng(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash, for turning words and dates into seeds. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick one element. The list must not be empty. */
export function pick<T>(r: Random, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)] as T;
}

/** Local date as YYYY-MM-DD (ISO 8601) without converting to UTC. */
export function isoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 1-based day of the year in local time. */
export function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return (
    Math.round(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 864e5,
    ) + 1
  );
}
