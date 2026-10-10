import { describe, expect, it } from 'vitest';
import { ReplicaLog, segmentFileName } from './log';
import type { KRecord } from './types';

const rec = (offset: number, key: string | null, value: string | null, timestamp = 0): KRecord => ({
  offset,
  key,
  value,
  timestamp,
  size: 100,
  leaderEpoch: 0,
  producer: 'test',
});

describe('ReplicaLog', () => {
  it('rolls segments at segment.bytes and reads ranges across them', () => {
    const log = new ReplicaLog(() => 0);
    for (let i = 0; i < 10; i++) log.append(rec(i, null, 'v'), 300);
    expect(log.segments.map((s) => s.baseOffset)).toEqual([0, 3, 6, 9]);
    expect(log.logEndOffset).toBe(10);
    expect(log.read(4, 8).map((r) => r.offset)).toEqual([4, 5, 6, 7]);
    expect(log.read(4, 8, 2).map((r) => r.offset)).toEqual([4, 5]);
    expect(segmentFileName(9)).toBe('00000000000000000009.log');
  });

  it('truncates a diverged tail', () => {
    const log = new ReplicaLog(() => 0);
    for (let i = 0; i < 10; i++) log.append(rec(i, null, 'v'), 300);
    expect(log.truncateTo(5)).toBe(5);
    expect(log.logEndOffset).toBe(5);
    log.append(rec(5, null, 'new'), 300);
    expect(log.read(0).map((r) => r.offset)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('deletes whole old segments but never the active one or past the limit', () => {
    let now = 0;
    const log = new ReplicaLog(() => now);
    for (let i = 0; i < 9; i++) log.append(rec(i, null, 'v', 0), 300);
    now = 10_000;
    expect(log.applyRetention(5_000, -1, 3).map((s) => s.baseOffset)).toEqual([0]);
    expect(log.logStartOffset).toBe(3);
    expect(log.applyRetention(5_000, -1, 100).map((s) => s.baseOffset)).toEqual([3]);
    expect(log.segments).toHaveLength(1);
  });

  it('applies retention.bytes', () => {
    const log = new ReplicaLog(() => 0);
    for (let i = 0; i < 9; i++) log.append(rec(i, null, 'v'), 300);
    log.applyRetention(-1, 400, 100);
    expect(log.logStartOffset).toBe(3); // 900 B > 400 B, but dropping a second segment would go under the limit;
  });

  it('compacts closed segments to the newest value per key, keeping fresh tombstones', () => {
    let now = 0;
    const log = new ReplicaLog(() => now);
    const keys = ['a', 'b', 'a', 'c', 'b', 'a', 'c', 'x'];
    keys.forEach((k, i) => log.append(rec(i, k, i === 6 ? null : `v${i}`), 300));
    // segments: [0..2] [3..5] [6..7 active]
    expect(log.compact(6, 1000)).toBe(4);
    expect(log.read(0).map((r) => `${r.offset}${r.key}`)).toEqual(['4b', '5a', '6c', '7x']);
    now = 5000;
    log.append(rec(8, 'y', 'v'), 200); // closes [6..7]
    log.compact(8, 1000);
    expect(log.read(0).map((r) => r.offset)).toEqual([4, 5, 7, 8]);
  });
});
