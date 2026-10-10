// The functions a reader writes in "Build your own Kafka", with the tests that
// decide when their version may replace Kafka's in the demos.
import type { ExerciseTest } from '@shiqi/code';
import {
  encodeBatch,
  KAFKA_POLICIES,
  recoverHelpers,
  type IndexEntry,
  type PolicyName,
  type StoragePolicies,
} from '@shiqi/kafka/storage';

export interface ExerciseSpec<N extends PolicyName = PolicyName> {
  policy: N;
  starter: string;
  solution: string;
  tests: ExerciseTest<StoragePolicies[N]>[];
}

/** An array that counts how many of its elements were read. */
export function countingArray<T>(items: T[]): {
  array: T[];
  reads: () => number;
  probed: number[];
} {
  const probed: number[] = [];
  const array = new Proxy(items, {
    get(target, prop, recv) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) probed.push(Number(prop));
      return Reflect.get(target, prop, recv) as unknown;
    },
  });
  return { array, reads: () => probed.length, probed };
}

const writeVarint: ExerciseSpec<'writeVarint'> = {
  policy: 'writeVarint',
  starter: `/**
 * Encode \`value\` the way a Kafka record stores its lengths and deltas.
 *
 * 1. Zigzag: 0 → 0, -1 → 1, 1 → 2, -2 → 3, 2 → 4 … so small negative
 *    numbers stay small.
 * 2. Write 7 bits per byte, lowest bits first. Every byte except the last
 *    has its top bit (0x80) set, meaning "more bytes follow".
 *
 * writeVarint(1)   → [2]
 * writeVarint(-1)  → [1]
 * writeVarint(300) → [216, 4]
 */
function writeVarint(value: number): number[] {
  const bytes: number[] = [];

  return bytes;
}
`,
  solution: `function writeVarint(value: number): number[] {
  let n = value >= 0 ? value * 2 : -value * 2 - 1; // zigzag
  const bytes: number[] = [];
  while (n >= 0x80) {
    bytes.push((n % 0x80) | 0x80); // low 7 bits, "more follows"
    n = Math.floor(n / 0x80);
  }
  bytes.push(n);
  return bytes;
}`,
  tests: [
    { name: '0 is one byte: [0]', run: (f) => f(0), expect: [0] },
    { name: '-1 zigzags to 1', run: (f) => f(-1), expect: [1] },
    { name: '1 zigzags to 2', run: (f) => f(1), expect: [2] },
    { name: '63 still fits in one byte', run: (f) => f(63), expect: [0x7e] },
    { name: '64 needs a second byte', run: (f) => f(64), expect: [0x80, 0x01] },
    { name: '300 → [216, 4]', run: (f) => f(300), expect: [0xd8, 0x04] },
    { name: '-64 is still one byte', run: (f) => f(-64), expect: [0x7f] },
    { name: 'the largest 32-bit int takes five bytes', run: (f) => f(2 ** 31 - 1) },
    { name: 'a timestamp delta of a day', run: (f) => f(86_400_000) },
    { name: 'a negative delta (out-of-order timestamps)', run: (f) => f(-5000) },
  ],
};

const entries = (offsets: number[]): IndexEntry[] =>
  offsets.map((offset, i) => ({ offset, position: i * 100 }));

const lookup: ExerciseSpec<'lookup'> = {
  policy: 'lookup',
  starter: `interface IndexEntry {
  offset: number;   // last offset of a batch
  position: number; // byte where that batch starts in the .log file
}

/**
 * The .index file is sorted by offset. Return the entry with the largest
 * offset that is ≤ target, or null if every entry is bigger. The broker
 * starts reading the .log file at that entry's position.
 *
 * Indexes have thousands of entries and this runs on every fetch.
 */
function lookup(index: IndexEntry[], target: number): IndexEntry | null {
  return null;
}
`,
  solution: `function lookup(index: IndexEntry[], target: number): IndexEntry | null {
  let lo = 0;
  let hi = index.length - 1;
  let found: IndexEntry | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (index[mid].offset <= target) {
      found = index[mid]; // a candidate; look right for a bigger one
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}`,
  tests: [
    { name: 'an empty index has no entry', run: (f) => f([], 5), expect: null },
    {
      name: 'target before the first entry',
      run: (f) => f(entries([10, 20, 30]), 5),
      expect: null,
    },
    { name: 'exact match', run: (f) => f(entries([10, 20, 30]), 20) },
    { name: 'between two entries', run: (f) => f(entries([10, 20, 30]), 25) },
    { name: 'past the last entry', run: (f) => f(entries([10, 20, 30]), 99) },
    { name: 'one entry', run: (f) => f(entries([7]), 8) },
    {
      name: 'reads at most 40 of 100,000 entries',
      run: (f) => {
        const c = countingArray(entries(Array.from({ length: 100_000 }, (_, i) => i * 3)));
        const hit = f(c.array, 123_457);
        return { hit, fast: c.reads() <= 40 };
      },
      expect: { hit: { offset: 123_456, position: 4_115_200 }, fast: true },
    },
  ],
};

const seg = (baseOffset: number, sizeBytes: number, largestTimestamp: number) => ({
  baseOffset,
  sizeBytes,
  largestTimestamp,
});
const H = 3_600_000;
const five = [
  seg(0, 1000, 1 * H),
  seg(10, 1000, 2 * H),
  seg(20, 1000, 3 * H),
  seg(30, 1000, 4 * H),
  seg(40, 300, 5 * H),
];

const segmentsToDelete: ExerciseSpec<'segmentsToDelete'> = {
  policy: 'segmentsToDelete',
  starter: `interface SegmentInfo {
  baseOffset: number;
  sizeBytes: number;
  largestTimestamp: number; // newest record in the segment, in ms
}

/**
 * Segments are oldest first; the last one is the active segment being
 * written to and is never deleted. Return how many of the OLDEST segments
 * retention deletes:
 *
 * - retentionMs: a segment goes when its newest record is older than this.
 * - retentionBytes: delete the oldest while the log would still be at least
 *   this big without it.
 *
 * Either limit can be -1, meaning off. A segment goes if either says so.
 */
function segmentsToDelete(
  segments: SegmentInfo[],
  now: number,
  config: { retentionMs: number; retentionBytes: number },
): number {
  return 0;
}
`,
  solution: `function segmentsToDelete(segments: SegmentInfo[], now: number, config: { retentionMs: number; retentionBytes: number }): number {
  const deletable = segments.length - 1; // never the active segment
  let n = 0;
  if (config.retentionMs >= 0) {
    while (n < deletable && now - segments[n].largestTimestamp > config.retentionMs) {
      n++;
    }
  }
  if (config.retentionBytes >= 0) {
    let size = 0;
    for (let i = n; i < segments.length; i++) {
      size += segments[i].sizeBytes;
    }
    while (n < deletable && size - segments[n].sizeBytes >= config.retentionBytes) {
      size -= segments[n].sizeBytes;
      n++;
    }
  }
  return n;
}`,
  tests: [
    {
      name: 'nothing expires with both limits off',
      run: (f) => f(five, 100 * H, { retentionMs: -1, retentionBytes: -1 }),
      expect: 0,
    },
    {
      name: 'by time: segments older than 2.5 h',
      run: (f) => f(five, 5.6 * H, { retentionMs: 2.5 * H, retentionBytes: -1 }),
      expect: 3,
    },
    {
      name: 'never the active segment, however old',
      run: (f) => f(five, 1000 * H, { retentionMs: H, retentionBytes: -1 }),
      expect: 4,
    },
    {
      name: 'by size: keep at least 2000 bytes',
      run: (f) => f(five, 0, { retentionMs: -1, retentionBytes: 2000 }),
      expect: 2,
    },
    {
      name: 'a segment the size limit would leave too small stays',
      run: (f) => f(five, 0, { retentionMs: -1, retentionBytes: 4000 }),
      expect: 0,
    },
    {
      name: 'both limits: whichever deletes more',
      run: (f) => f(five, 3.5 * H, { retentionMs: 2 * H, retentionBytes: 1500 }),
    },
    {
      name: 'only a prefix: a new segment in the middle stops it',
      run: (f) =>
        f([seg(0, 100, 10 * H), seg(5, 100, 1 * H), seg(9, 100, 11 * H)], 12 * H, {
          retentionMs: 5 * H,
          retentionBytes: -1,
        }),
      expect: 0,
    },
  ],
};

/** Three batches back to back, for the recover tests. */
function sampleLog(): { log: Uint8Array; ends: number[] } {
  const parts = [0, 1, 2].map(
    (i) =>
      encodeBatch({
        baseOffset: i,
        records: [{ key: `k${i}`, value: `value ${i}`, timestamp: 1000 * i }],
      }).bytes,
  );
  const log = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  const ends: number[] = [];
  let at = 0;
  for (const p of parts) {
    log.set(p, at);
    at += p.length;
    ends.push(at);
  }
  return { log, ends };
}

const recoverRun = (f: StoragePolicies['recover'], log: Uint8Array) => f(log, recoverHelpers(log));

const recover: ExerciseSpec<'recover'> = {
  policy: 'recover',
  starter: `/**
 * The broker lost power. Walk the .log file batch by batch from byte 0 and
 * return how many bytes at the start are whole, valid batches. The broker
 * cuts the file there.
 *
 * Every batch starts with:
 *   bytes 0–7   base offset
 *   bytes 8–11  length of the rest of the batch (int32)
 * so a batch at \`pos\` ends at pos + 12 + length.
 *
 * helpers.readInt32(log, pos)      reads a big-endian int32
 * helpers.crcMatches(start, end)   checks the batch's CRC-32C
 */
function recover(
  log: Uint8Array,
  helpers: {
    readInt32: (log: Uint8Array, pos: number) => number;
    crcMatches: (start: number, end: number) => boolean;
  },
): number {
  return log.length;
}
`,
  solution: `function recover(log: Uint8Array, helpers: { readInt32: (log: Uint8Array, pos: number) => number; crcMatches: (start: number, end: number) => boolean }): number {
  let pos = 0;
  while (pos + 12 <= log.length) {
    const end = pos + 12 + helpers.readInt32(log, pos + 8);
    if (end > log.length || !helpers.crcMatches(pos, end)) {
      break; // torn or corrupt: everything from here is cut
    }
    pos = end;
  }
  return pos;
}`,
  tests: [
    { name: 'an empty file', run: (f) => recoverRun(f, new Uint8Array(0)), expect: 0 },
    {
      name: 'three whole batches are all kept',
      run: (f) => {
        const { log } = sampleLog();
        return recoverRun(f, log) === log.length;
      },
      expect: true,
    },
    {
      name: 'a batch cut in half is dropped',
      run: (f) => {
        const { log, ends } = sampleLog();
        return recoverRun(f, log.slice(0, (ends[1] as number) + 20)) === ends[1];
      },
      expect: true,
    },
    {
      name: 'a few stray bytes after the last batch are dropped',
      run: (f) => {
        const { log, ends } = sampleLog();
        return recoverRun(f, log.slice(0, (ends[0] as number) + 5)) === ends[0];
      },
      expect: true,
    },
    {
      name: 'a flipped byte in the middle cuts everything from that batch on',
      run: (f) => {
        const { log, ends } = sampleLog();
        const bad = log.slice();
        bad[(ends[0] as number) + 40] = (bad[(ends[0] as number) + 40] as number) ^ 0xff;
        return recoverRun(f, bad) === ends[0];
      },
      expect: true,
    },
  ],
};

export const EXERCISES = { writeVarint, lookup, segmentsToDelete, recover } as const;

export const reference = <N extends PolicyName>(n: N) => KAFKA_POLICIES[n];
