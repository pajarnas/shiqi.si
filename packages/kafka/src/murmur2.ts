// Kafka's default partitioner hashes keys with murmur2 (Utils.murmur2 in the
// Java client), so a key lands on the same partition here as on a real cluster
// with the same partition count.

const encoder = new TextEncoder();

/** 32-bit murmur2 with Kafka's seed, as a signed int like Java returns. */
export function murmur2(data: Uint8Array | string): number {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  const length = bytes.length;
  const m = 0x5bd1e995;
  let h = 0x9747b28c ^ length;
  const byte = (i: number) => (bytes[i] ?? 0) & 0xff;

  const whole = length & ~3;
  for (let i = 0; i < whole; i += 4) {
    let k = byte(i) | (byte(i + 1) << 8) | (byte(i + 2) << 16) | (byte(i + 3) << 24);
    k = Math.imul(k, m);
    k ^= k >>> 24;
    k = Math.imul(k, m);
    h = Math.imul(h, m) ^ k;
  }

  const rest = length & 3;
  if (rest === 3) h ^= byte(whole + 2) << 16;
  if (rest >= 2) h ^= byte(whole + 1) << 8;
  if (rest >= 1) h = Math.imul(h ^ byte(whole), m);

  h ^= h >>> 13;
  h = Math.imul(h, m);
  h ^= h >>> 15;
  return h | 0;
}

/** Utils.toPositive: clears the sign bit (not Math.abs, which overflows on MIN_VALUE). */
export const toPositive = (n: number) => n & 0x7fffffff;

/** The partition a keyed record goes to: toPositive(murmur2(key)) % partitions. */
export const partitionForKey = (key: string, partitions: number) =>
  toPositive(murmur2(key)) % partitions;
