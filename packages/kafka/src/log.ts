// One replica's copy of a partition: an append-only log split into segments,
// like the 00000000000000000000.log files in a broker's data directory.
import type { KRecord } from './types';

export interface Segment {
  /** Offset of the first record written to this segment (its file name). */
  baseOffset: number;
  records: KRecord[];
  bytes: number;
  /** Simulated time the segment was opened. */
  createdAt: number;
}

/** File name Kafka gives a segment: the base offset padded to 20 digits. */
export const segmentFileName = (baseOffset: number, ext: 'log' | 'index' | 'timeindex' = 'log') =>
  `${String(baseOffset).padStart(20, '0')}.${ext}`;

export class ReplicaLog {
  segments: Segment[] = [];
  /** First offset still on disk; everything below was deleted by retention. */
  logStartOffset = 0;
  /** Log end offset: the offset the next record will get. */
  logEndOffset = 0;

  constructor(private readonly now: () => number) {
    this.segments.push(this.newSegment(0));
  }

  private newSegment(baseOffset: number): Segment {
    return { baseOffset, records: [], bytes: 0, createdAt: this.now() };
  }

  get active(): Segment {
    return this.segments[this.segments.length - 1] as Segment;
  }

  get sizeBytes() {
    return this.segments.reduce((sum, s) => sum + s.bytes, 0);
  }

  get recordCount() {
    return this.segments.reduce((sum, s) => sum + s.records.length, 0);
  }

  /** Leader epoch of the last record, or -1 for an empty log. */
  get lastEpoch(): number {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const recs = this.segments[i]?.records ?? [];
      const last = recs[recs.length - 1];
      if (last) return last.leaderEpoch;
    }
    return -1;
  }

  /**
   * Write a record at `record.offset` (the leader assigns offsets; followers
   * copy them). Rolls to a new segment when the active one would exceed
   * `segmentBytes`.
   */
  append(record: KRecord, segmentBytes: number) {
    if (this.active.records.length > 0 && this.active.bytes + record.size > segmentBytes) {
      this.segments.push(this.newSegment(record.offset));
    }
    if (this.active.records.length === 0) this.active.baseOffset = record.offset;
    this.active.records.push(record);
    this.active.bytes += record.size;
    this.logEndOffset = record.offset + 1;
  }

  /** Records with offset in [from, to), at most `max` of them. */
  read(from: number, to = this.logEndOffset, max = Infinity): KRecord[] {
    const out: KRecord[] = [];
    for (const seg of this.segments) {
      const next = this.segments[this.segments.indexOf(seg) + 1];
      if (next && next.baseOffset <= from) continue;
      for (const r of seg.records) {
        if (r.offset < from) continue;
        if (r.offset >= to || out.length >= max) return out;
        out.push(r);
      }
    }
    return out;
  }

  /** Drop every record at or above `offset`. Returns how many were removed. */
  truncateTo(offset: number): number {
    if (offset >= this.logEndOffset) return 0;
    let removed = 0;
    for (const seg of this.segments) {
      const keep = seg.records.filter((r) => r.offset < offset);
      removed += seg.records.length - keep.length;
      seg.records = keep;
      seg.bytes = keep.reduce((s, r) => s + r.size, 0);
    }
    this.segments = this.segments.filter((s, i) => i === 0 || s.records.length > 0);
    this.logEndOffset = Math.max(offset, this.logStartOffset);
    if (this.active.records.length === 0) this.active.baseOffset = this.logEndOffset;
    return removed;
  }

  /** Move the end forward over offsets that no longer exist anywhere (compacted on the leader). */
  advanceTo(offset: number) {
    if (offset <= this.logEndOffset) return;
    this.logEndOffset = offset;
    if (this.active.records.length === 0) this.active.baseOffset = offset;
  }

  /** Throw everything away and restart at `offset` (a follower too far behind the leader). */
  resetTo(offset: number) {
    this.segments = [this.newSegment(offset)];
    this.logStartOffset = offset;
    this.logEndOffset = offset;
  }

  /**
   * Retention: delete whole closed segments that are older than `retentionMs`
   * or push the log over `retentionBytes`. Never touches the active segment or
   * anything at or above `limit` (the high watermark). Returns deleted segments.
   */
  applyRetention(retentionMs: number, retentionBytes: number, limit: number): Segment[] {
    const deleted: Segment[] = [];
    let size = this.sizeBytes;
    while (this.segments.length > 1) {
      const seg = this.segments[0] as Segment;
      const next = this.segments[1] as Segment;
      if (next.baseOffset > limit) break;
      const newest = seg.records[seg.records.length - 1]?.timestamp ?? seg.createdAt;
      const tooOld = retentionMs >= 0 && this.now() - newest > retentionMs;
      const tooBig = retentionBytes >= 0 && size - seg.bytes >= retentionBytes;
      if (!tooOld && !tooBig) break;
      this.segments.shift();
      size -= seg.bytes;
      this.logStartOffset = next.baseOffset;
      deleted.push(seg);
    }
    return deleted;
  }

  /**
   * Log compaction: in closed segments below `limit`, keep only the newest
   * record for each key. Tombstones (null values) survive for
   * `deleteRetentionMs` so consumers can see the delete, then go too.
   * Returns how many records were removed.
   */
  compact(limit: number, deleteRetentionMs: number): number {
    const cleanable = this.segments.slice(0, -1);
    const newest = new Map<string, number>();
    for (const seg of cleanable) {
      for (const r of seg.records) {
        if (r.offset < limit && r.key !== null) newest.set(r.key, r.offset);
      }
    }
    // A key rewritten in the active segment makes every closed copy stale too.
    for (const r of this.active.records) if (r.key !== null) newest.set(r.key, r.offset);

    let removed = 0;
    for (const seg of cleanable) {
      const keep = seg.records.filter((r) => {
        if (r.offset >= limit || r.key === null) return true;
        if (newest.get(r.key) !== r.offset) return false;
        return r.value !== null || this.now() - r.timestamp <= deleteRetentionMs;
      });
      removed += seg.records.length - keep.length;
      seg.records = keep;
      seg.bytes = keep.reduce((s, r) => s + r.size, 0);
    }
    return removed;
  }
}
