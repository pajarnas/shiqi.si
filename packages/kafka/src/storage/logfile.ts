// One partition's directory on a broker, byte for byte: segment .log files of
// real v2 record batches, a sparse .index per segment, and the page cache
// between them and the disk. Every decision a reader can rewrite goes through
// `policies`.
import {
  BATCH_HEADER_BYTES,
  batchEnd,
  decodeBatch,
  encodeBatch,
  LOG_OVERHEAD,
  type RecordInput,
} from './batch';
import { readInt32, readInt64 } from './bytes';
import {
  KAFKA_POLICIES,
  recoverHelpers,
  type IndexEntry,
  type SegmentInfo,
  type StoragePolicies,
} from './policies';

export interface LogConfig {
  /** segment.bytes: roll to a new segment file past this size. */
  segmentBytes: number;
  /** index.interval.bytes: add an index entry after this many bytes. */
  indexIntervalBytes: number;
  retentionMs: number;
  retentionBytes: number;
  /** Page size the page cache writes back in; small here so torn writes are easy to see. */
  pageBytes: number;
}

export const DEFAULT_LOG_CONFIG: LogConfig = {
  segmentBytes: 2048,
  indexIntervalBytes: 256,
  retentionMs: -1,
  retentionBytes: -1,
  pageBytes: 128,
};

export class LogSegment {
  data = new Uint8Array(0);
  index: IndexEntry[] = [];
  /** Bytes of `data` that are on disk; the rest is only in the page cache. */
  durable = 0;
  largestTimestamp = -1;
  bytesSinceIndex = 0;

  constructor(
    readonly baseOffset: number,
    readonly createdAt: number,
  ) {}

  get size() {
    return this.data.length;
  }

  get dirty() {
    return this.data.length - this.durable;
  }

  /** Positions where each batch starts, in order. */
  batchPositions(): number[] {
    const out: number[] = [];
    for (let p = 0; p + LOG_OVERHEAD <= this.data.length;) {
      const end = batchEnd(this.data, p);
      if (end > this.data.length || end < p + BATCH_HEADER_BYTES) break;
      out.push(p);
      p = end;
    }
    return out;
  }

  write(bytes: Uint8Array) {
    const next = new Uint8Array(this.data.length + bytes.length);
    next.set(this.data);
    next.set(bytes, this.data.length);
    this.data = next;
  }

  truncate(size: number) {
    this.data = this.data.slice(0, size);
    this.durable = Math.min(this.durable, size);
    this.index = this.index.filter((e) => e.position < size);
  }
}

export interface AppendResult {
  baseOffset: number;
  lastOffset: number;
  segment: LogSegment;
  position: number;
  size: number;
  rolled: boolean;
  indexed: boolean;
}

export interface ReadResult {
  segment: LogSegment;
  /** The index entry the search started from (null: no entry, so from the start of the file). */
  entry: IndexEntry | null;
  /** Batch start positions read while scanning forward, in order. */
  scanned: number[];
  /** Where the batch holding the offset starts. */
  position: number;
  bytesScanned: number;
}

export interface RecoveryReport {
  segment: number;
  validBytes: number;
  truncatedBytes: number;
  /** Segments after a torn one are deleted too. */
  deletedSegments: number;
  /** Log end offset before and after. */
  before: number;
  after: number;
}

export class OffsetOutOfRange extends Error {
  constructor(
    readonly offset: number,
    readonly logStartOffset: number,
    readonly logEndOffset: number,
  ) {
    super(`OFFSET_OUT_OF_RANGE: ${offset} is outside [${logStartOffset}, ${logEndOffset})`);
  }
}

/** A small deterministic generator, so a power cut with the same seed tears the same bytes. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class PartitionLog {
  segments: LogSegment[];
  logStartOffset = 0;
  logEndOffset = 0;
  /** Set by a power cut; recover() clears it. */
  unclean = false;
  config: LogConfig;

  constructor(
    config: Partial<LogConfig> = {},
    public policies: StoragePolicies = KAFKA_POLICIES,
  ) {
    this.config = { ...DEFAULT_LOG_CONFIG, ...config };
    this.segments = [new LogSegment(0, 0)];
  }

  get active(): LogSegment {
    return this.segments[this.segments.length - 1] as LogSegment;
  }

  get size() {
    return this.segments.reduce((n, s) => n + s.size, 0);
  }

  get dirty() {
    return this.segments.reduce((n, s) => n + s.dirty, 0);
  }

  /** Append one batch of records, as one produce request would. */
  append(records: RecordInput[], leaderEpoch = 0, policies = this.policies): AppendResult {
    if (this.unclean) throw new Error('The log needs recovery before it can be written.');
    const { bytes } = encodeBatch({ baseOffset: this.logEndOffset, leaderEpoch, records }, (v) =>
      policies.writeVarint(v),
    );
    let rolled = false;
    if (this.active.size > 0 && this.active.size + bytes.length > this.config.segmentBytes) {
      this.segments.push(new LogSegment(this.logEndOffset, records[0]?.timestamp ?? 0));
      rolled = true;
    }
    const seg = this.active;
    const position = seg.size;
    const lastOffset = this.logEndOffset + records.length - 1;
    // Like LogSegment.append: an entry for this batch when enough bytes went by since the last one.
    let indexed = false;
    if (seg.bytesSinceIndex > this.config.indexIntervalBytes) {
      seg.index.push({ offset: lastOffset, position });
      seg.bytesSinceIndex = 0;
      indexed = true;
    }
    seg.write(bytes);
    seg.bytesSinceIndex += bytes.length;
    for (const r of records) seg.largestTimestamp = Math.max(seg.largestTimestamp, r.timestamp);
    const baseOffset = this.logEndOffset;
    this.logEndOffset += records.length;
    return { baseOffset, lastOffset, segment: seg, position, size: bytes.length, rolled, indexed };
  }

  /** Find the batch holding `offset` the way Kafka does: segment, then index, then scan. */
  locate(offset: number, policies = this.policies): ReadResult {
    if (offset < this.logStartOffset || offset >= this.logEndOffset)
      throw new OffsetOutOfRange(offset, this.logStartOffset, this.logEndOffset);
    let segment = this.segments[0] as LogSegment;
    for (const s of this.segments) if (s.baseOffset <= offset) segment = s;
    const entry = policies.lookup(segment.index, offset);
    const scanned: number[] = [];
    // Trusts the index, like Kafka: a wrong entry means reading the wrong batch.
    let pos = entry ? Math.max(0, Math.min(segment.size, entry.position)) : 0;
    const start = pos;
    while (pos + LOG_OVERHEAD <= segment.size) {
      scanned.push(pos);
      const base = readInt64(segment.data, pos);
      const lastDelta = readInt32(segment.data, pos + 23);
      if (base + lastDelta >= offset) break;
      const next = batchEnd(segment.data, pos);
      if (next <= pos) break;
      pos = next;
    }
    return { segment, entry, scanned, position: pos, bytesScanned: pos - start };
  }

  /** Records from `offset` to the end of its batch. */
  read(offset: number, policies = this.policies) {
    const r = this.locate(offset, policies);
    return decodeBatch(r.segment.data, r.position).records.filter((x) => x.offset >= offset);
  }

  segmentInfos(): SegmentInfo[] {
    return this.segments.map((s) => ({
      baseOffset: s.baseOffset,
      sizeBytes: s.size,
      largestTimestamp: s.largestTimestamp,
    }));
  }

  /** Apply retention; returns the deleted segments. */
  deleteOldSegments(now: number, policies = this.policies): LogSegment[] {
    const n = Math.max(
      0,
      Math.min(
        this.segments.length - 1,
        Math.floor(policies.segmentsToDelete(this.segmentInfos(), now, this.config)),
      ),
    );
    const gone = this.segments.splice(0, n);
    if (n) this.logStartOffset = (this.segments[0] as LogSegment).baseOffset;
    return gone;
  }

  /** fsync every segment: the page cache is written to disk. */
  flush() {
    for (const s of this.segments) s.durable = s.size;
  }

  /**
   * The machine loses power. The OS had been writing dirty pages back in
   * order, so each segment keeps what was durable plus some whole pages of
   * the rest; a batch can be cut in half at a page boundary.
   */
  powerLoss(random: () => number = seededRandom(this.logEndOffset)) {
    const page = this.config.pageBytes;
    for (const s of this.segments) {
      if (!s.dirty) continue;
      const firstPage = Math.ceil(s.durable / page);
      const lastPage = Math.floor(s.size / page);
      const pages = Math.max(0, lastPage - firstPage);
      const kept = Math.floor(random() * (pages + 1));
      const cut = Math.max(s.durable, Math.min(s.size, (firstPage + kept) * page));
      s.truncate(cut);
      s.durable = cut;
      s.index = [];
      s.bytesSinceIndex = 0;
    }
    this.unclean = true;
  }

  /**
   * Startup after an unclean shutdown: check every batch, cut the log at the
   * first broken one, delete everything after it and rebuild the indexes.
   * Like UnifiedLog's recovery of segments past the recovery point.
   */
  recover(policies = this.policies): RecoveryReport[] {
    const reports: RecoveryReport[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i] as LogSegment;
      const before = this.computeEnd();
      const valid = Math.max(
        0,
        Math.min(s.size, Math.floor(policies.recover(s.data, recoverHelpers(s.data)))),
      );
      const truncated = s.size - valid;
      let deleted = 0;
      if (truncated) {
        s.truncate(valid);
        deleted = this.segments.length - i - 1;
        this.segments.splice(i + 1);
      }
      this.rebuildIndex(s);
      if (truncated || deleted)
        reports.push({
          segment: s.baseOffset,
          validBytes: valid,
          truncatedBytes: truncated,
          deletedSegments: deleted,
          before,
          after: this.computeEnd(),
        });
    }
    this.logEndOffset = this.computeEnd();
    this.unclean = false;
    return reports;
  }

  private rebuildIndex(s: LogSegment) {
    s.index = [];
    s.bytesSinceIndex = 0;
    for (const p of s.batchPositions()) {
      if (s.bytesSinceIndex > this.config.indexIntervalBytes) {
        s.index.push({ offset: lastOffsetAt(s.data, p), position: p });
        s.bytesSinceIndex = 0;
      }
      s.bytesSinceIndex += batchEnd(s.data, p) - p;
    }
  }

  private computeEnd() {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const s = this.segments[i] as LogSegment;
      const positions = s.batchPositions();
      const last = positions[positions.length - 1];
      if (last !== undefined) return lastOffsetAt(s.data, last) + 1;
      if (i === 0) return s.baseOffset;
    }
    return 0;
  }
}

const lastOffsetAt = (data: Uint8Array, pos: number) =>
  readInt64(data, pos) + readInt32(data, pos + 23);

export type { RecordInput };
