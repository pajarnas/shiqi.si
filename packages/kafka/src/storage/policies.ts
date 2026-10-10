// The parts of the storage layer a reader writes themselves in "Build your own
// Kafka". The engine only ever calls these through a StoragePolicies object,
// so a reader's version can replace Kafka's one function at a time.
import { LOG_OVERHEAD } from './batch';
import { crc32c, readInt32, readUint32, writeVarint } from './bytes';

/** One entry in a segment's .index file: the last offset of a batch and where the batch starts. */
export interface IndexEntry {
  offset: number;
  position: number;
}

export interface SegmentInfo {
  baseOffset: number;
  sizeBytes: number;
  /** Newest record timestamp in the segment (what retention.ms is measured against). */
  largestTimestamp: number;
}

export interface RetentionConfig {
  /** -1 means keep forever. */
  retentionMs: number;
  /** -1 means no size limit. */
  retentionBytes: number;
}

/** Helpers handed to `recover`, so it can read the file without a byte library. */
export interface RecoverHelpers {
  readInt32: (log: Uint8Array, pos: number) => number;
  /** Does the CRC stored in the batch at [start, end) match its bytes? */
  crcMatches: (start: number, end: number) => boolean;
}

export interface StoragePolicies {
  /** Zigzag varint, 7 bits per byte, low bits first. */
  writeVarint(value: number): number[];
  /** The entry with the largest offset ≤ target, or null when every entry is bigger. */
  lookup(index: readonly IndexEntry[], target: number): IndexEntry | null;
  /** How many of the oldest segments to delete. The last (active) segment is never deleted. */
  segmentsToDelete(segments: readonly SegmentInfo[], now: number, config: RetentionConfig): number;
  /** How many bytes at the start of `log` are whole, valid batches. */
  recover(log: Uint8Array, helpers: RecoverHelpers): number;
}

export type PolicyName = keyof StoragePolicies;

/** Kafka's own behaviour: what OffsetIndex, UnifiedLog and LogSegment do. */
export const KAFKA_POLICIES: StoragePolicies = {
  writeVarint,

  lookup(index, target) {
    let lo = 0;
    let hi = index.length - 1;
    let found: IndexEntry | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const e = index[mid] as IndexEntry;
      if (e.offset <= target) {
        found = e;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  },

  segmentsToDelete(segments, now, { retentionMs, retentionBytes }) {
    const deletable = segments.length - 1;
    let n = 0;
    if (retentionMs >= 0)
      while (n < deletable && now - (segments[n] as SegmentInfo).largestTimestamp > retentionMs)
        n++;
    if (retentionBytes >= 0) {
      let size = segments.reduce((sum, s) => sum + s.sizeBytes, 0);
      for (let i = 0; i < n; i++) size -= (segments[i] as SegmentInfo).sizeBytes;
      while (n < deletable && size - (segments[n] as SegmentInfo).sizeBytes >= retentionBytes) {
        size -= (segments[n] as SegmentInfo).sizeBytes;
        n++;
      }
    }
    return n;
  },

  recover(log, { readInt32: int32, crcMatches }) {
    let pos = 0;
    while (pos + LOG_OVERHEAD <= log.length) {
      const end = pos + LOG_OVERHEAD + int32(log, pos + 8);
      if (end > log.length || !crcMatches(pos, end)) break;
      pos = end;
    }
    return pos;
  },
};

export const recoverHelpers = (log: Uint8Array): RecoverHelpers => ({
  readInt32,
  crcMatches: (start, end) =>
    end - start > 21 && readUint32(log, start + 17) === crc32c(log, start + 21, end),
});
