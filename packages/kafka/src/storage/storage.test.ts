import { describe, expect, it } from 'vitest';
import {
  batchIsValid,
  crc32c,
  decodeBatch,
  encodeBatch,
  KAFKA_POLICIES,
  OffsetOutOfRange,
  PartitionLog,
  readVarint,
  recoverHelpers,
  utf8,
  writeVarint,
} from './index';

describe('varints', () => {
  it('match Kafka ByteUtils vectors', () => {
    expect(writeVarint(0)).toEqual([0]);
    expect(writeVarint(-1)).toEqual([1]);
    expect(writeVarint(1)).toEqual([2]);
    expect(writeVarint(63)).toEqual([0x7e]);
    expect(writeVarint(-64)).toEqual([0x7f]);
    expect(writeVarint(64)).toEqual([0x80, 0x01]);
    expect(writeVarint(300)).toEqual([0xd8, 0x04]);
    expect(writeVarint(2 ** 31 - 1)).toEqual([0xfe, 0xff, 0xff, 0xff, 0x0f]);
    expect(writeVarint(-(2 ** 31))).toEqual([0xff, 0xff, 0xff, 0xff, 0x0f]);
  });

  it('round-trip', () => {
    for (const n of [0, 1, -1, 127, -128, 1e6, -1e9, 2 ** 40, -(2 ** 40)])
      expect(readVarint(Uint8Array.from(writeVarint(n)), 0)).toEqual({
        value: n,
        size: writeVarint(n).length,
      });
  });
});

describe('crc32c', () => {
  it('matches the standard check value', () => {
    expect(crc32c(utf8('123456789')).toString(16)).toBe('e3069283');
  });
});

describe('record batches', () => {
  const input = {
    baseOffset: 42,
    leaderEpoch: 3,
    records: [
      { key: 'user-1', value: 'clicked', timestamp: 1_700_000_000_000 },
      { key: null, value: 'hi', timestamp: 1_700_000_000_005 },
      { key: 'gone', value: null, timestamp: 1_700_000_000_007 },
    ],
  };

  it('decode what they encode', () => {
    const { bytes } = encodeBatch(input);
    const d = decodeBatch(bytes, 0);
    expect(d.baseOffset).toBe(42);
    expect(d.leaderEpoch).toBe(3);
    expect(d.crcOk).toBe(true);
    expect(d.records).toEqual(input.records.map((r, i) => ({ ...r, offset: 42 + i })));
  });

  it('has a 61-byte header and a field map that covers every byte once', () => {
    const { bytes, fields } = encodeBatch(input);
    const header = fields.filter((f) => f.record === undefined);
    expect(header[header.length - 1]?.end).toBe(61);
    const covered = new Uint8Array(bytes.length);
    for (const f of fields) for (let i = f.start; i < f.end; i++) covered[i]!++;
    expect([...covered].every((c) => c === 1)).toBe(true);
  });

  it('catch a flipped bit with the CRC', () => {
    const { bytes } = encodeBatch(input);
    expect(batchIsValid(bytes, 0)).toBe(true);
    bytes[70] = (bytes[70] as number) ^ 1;
    expect(batchIsValid(bytes, 0)).toBe(false);
  });
});

const fill = (log: PartitionLog, n: number, t0 = 0) => {
  for (let i = 0; i < n; i++)
    log.append([
      { key: `k${i % 5}`, value: `value-${log.logEndOffset}`, timestamp: t0 + i * 1000 },
    ]);
};

describe('PartitionLog', () => {
  it('rolls segments and builds a sparse index', () => {
    const log = new PartitionLog({ segmentBytes: 1024, indexIntervalBytes: 200 });
    fill(log, 60);
    expect(log.segments.length).toBeGreaterThan(3);
    for (const s of log.segments) {
      expect(s.size).toBeLessThanOrEqual(1024);
      expect(s.index.length).toBeGreaterThan(0);
      expect(s.index.length).toBeLessThan(s.batchPositions().length);
    }
    expect(log.logEndOffset).toBe(60);
  });

  it('finds every offset through the index', () => {
    const log = new PartitionLog({ segmentBytes: 1024, indexIntervalBytes: 200 });
    fill(log, 60);
    for (let o = 0; o < 60; o++) expect(log.read(o)[0]?.value).toBe(`value-${o}`);
    expect(() => log.read(60)).toThrow(OffsetOutOfRange);
  });

  it('scans less with a denser index', () => {
    const scan = (interval: number) => {
      const log = new PartitionLog({ segmentBytes: 1 << 20, indexIntervalBytes: interval });
      fill(log, 200);
      return log.locate(150).bytesScanned;
    };
    expect(scan(100)).toBeLessThan(scan(4096));
  });

  it('applies retention by time and size, never to the active segment', () => {
    const log = new PartitionLog({ segmentBytes: 512, retentionMs: 10_000 });
    fill(log, 40);
    const gone = log.deleteOldSegments(40_000 + 10_000);
    expect(gone.length).toBeGreaterThan(0);
    expect(log.logStartOffset).toBe(log.segments[0]?.baseOffset);
    expect(() => log.read(0)).toThrow(OffsetOutOfRange);
    const left = log.segments.length;
    expect(log.deleteOldSegments(1e12)).toHaveLength(left - 1);

    const bySize = new PartitionLog({ segmentBytes: 512, retentionBytes: 1000 });
    fill(bySize, 40);
    bySize.deleteOldSegments(0);
    expect(bySize.size - bySize.active.size).toBeLessThan(1000);
  });

  it('loses unflushed bytes on power loss and recovers to the last whole batch', () => {
    const log = new PartitionLog({ segmentBytes: 1 << 20, pageBytes: 64 });
    fill(log, 10);
    log.flush();
    fill(log, 10, 10_000);
    log.powerLoss(() => 0.5);
    expect(log.unclean).toBe(true);
    const reports = log.recover();
    expect(log.logEndOffset).toBeGreaterThanOrEqual(10);
    expect(log.logEndOffset).toBeLessThan(20);
    expect(reports[0]?.truncatedBytes).toBeGreaterThan(0);
    for (let o = 0; o < log.logEndOffset; o++) expect(log.read(o)[0]?.value).toBe(`value-${o}`);
    log.append([{ key: null, value: 'after', timestamp: 0 }]);
    expect(log.read(log.logEndOffset - 1)[0]?.value).toBe('after');
  });

  it('keeps everything that was flushed', () => {
    const log = new PartitionLog();
    fill(log, 30);
    log.flush();
    log.powerLoss(() => 0);
    log.recover();
    expect(log.logEndOffset).toBe(30);
  });

  it('uses the policies it is given', () => {
    let calls = 0;
    const log = new PartitionLog(
      {},
      {
        ...KAFKA_POLICIES,
        lookup: (index, target) => {
          calls++;
          return KAFKA_POLICIES.lookup(index, target);
        },
      },
    );
    fill(log, 5);
    log.read(3);
    expect(calls).toBe(1);
  });

  it('recover stops at a torn batch', () => {
    const { bytes } = encodeBatch({
      baseOffset: 0,
      records: [{ key: 'a', value: 'b', timestamp: 0 }],
    });
    const two = new Uint8Array(bytes.length * 2 - 5);
    two.set(bytes);
    two.set(bytes.subarray(0, bytes.length - 5), bytes.length);
    expect(KAFKA_POLICIES.recover(two, recoverHelpers(two))).toBe(bytes.length);
  });
});
