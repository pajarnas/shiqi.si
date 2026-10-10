import { describe, expect, it } from 'vitest';
import { murmur2, partitionForKey, toPositive } from './murmur2';

describe('murmur2', () => {
  // Vectors from Kafka's UtilsTest.testMurmur2.
  it.each([
    ['21', -973932308],
    ['foobar', -790332482],
    ['a-little-bit-long-string', -985981536],
    ['a-little-bit-longer-string', -1486304829],
    ['lkjh234lh9fiuh90y23oiuhsafujhadof229phr9h19h89h8', -58897971],
    ['abc', 479470107],
  ])('hashes %s like the Java client', (key, expected) => {
    expect(murmur2(key)).toBe(expected);
  });

  it('keeps partitions stable and in range', () => {
    expect(toPositive(-1)).toBe(0x7fffffff);
    for (const key of ['user-1', 'user-2', 'order-42']) {
      const p = partitionForKey(key, 6);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(6);
      expect(partitionForKey(key, 6)).toBe(p);
    }
  });
});
