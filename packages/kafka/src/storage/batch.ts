// Record batch format v2 (magic 2), the layout of every batch in a .log file
// since Kafka 0.11 (KIP-98). Encoding also returns a map of which bytes are
// which field, so a view can annotate a hex dump.
import {
  ByteWriter,
  crc32c,
  fromUtf8,
  readInt32,
  readInt64,
  readInt8,
  readUint32,
  readVarint,
  utf8,
  writeVarint as referenceVarint,
} from './bytes';

export const BATCH_FIELDS = [
  'baseOffset',
  'batchLength',
  'partitionLeaderEpoch',
  'magic',
  'crc',
  'attributes',
  'lastOffsetDelta',
  'baseTimestamp',
  'maxTimestamp',
  'producerId',
  'producerEpoch',
  'baseSequence',
  'recordCount',
] as const;

export const RECORD_FIELDS = [
  'length',
  'attributes',
  'timestampDelta',
  'offsetDelta',
  'keyLength',
  'key',
  'valueLength',
  'value',
  'headerCount',
] as const;

export type BatchField = (typeof BATCH_FIELDS)[number];
export type RecordField = (typeof RECORD_FIELDS)[number];

/** Bytes from baseOffset through recordCount. */
export const BATCH_HEADER_BYTES = 61;
/** baseOffset + batchLength: the part before the length counts from. */
export const LOG_OVERHEAD = 12;
/** The CRC covers everything from attributes to the end. */
const CRC_START = 21;

export interface FieldSpan {
  /** Which record, or undefined for a batch header field. */
  record?: number;
  field: BatchField | RecordField;
  start: number;
  end: number;
  /** The decoded value, for display. */
  value: string;
}

export interface RecordInput {
  key: string | null;
  value: string | null;
  timestamp: number;
}

export interface BatchInput {
  baseOffset: number;
  leaderEpoch?: number;
  records: RecordInput[];
}

export interface EncodedBatch {
  bytes: Uint8Array;
  fields: FieldSpan[];
}

export type VarintWriter = (value: number) => number[];

/**
 * Encode one batch. `varint` writes every varint in the records; pass your
 * own to see what your encoder puts on disk.
 */
export function encodeBatch(
  input: BatchInput,
  varint: VarintWriter = referenceVarint,
): EncodedBatch {
  const w = new ByteWriter();
  const fields: FieldSpan[] = [];
  const span = (field: FieldSpan['field'], write: () => void, value: unknown, record?: number) => {
    const start = w.length;
    write();
    fields.push({ record, field, start, end: w.length, value: String(value) });
  };
  const { records } = input;
  const baseTs = records[0]?.timestamp ?? 0;
  const maxTs = records.reduce((m, r) => Math.max(m, r.timestamp), baseTs);

  span('baseOffset', () => w.int64(input.baseOffset), input.baseOffset);
  span('batchLength', () => w.int32(0), '');
  span('partitionLeaderEpoch', () => w.int32(input.leaderEpoch ?? 0), input.leaderEpoch ?? 0);
  span('magic', () => w.int8(2), 2);
  span('crc', () => w.int32(0), '');
  span('attributes', () => w.int16(0), 0);
  span('lastOffsetDelta', () => w.int32(Math.max(0, records.length - 1)), records.length - 1);
  span('baseTimestamp', () => w.int64(baseTs), baseTs);
  span('maxTimestamp', () => w.int64(maxTs), maxTs);
  span('producerId', () => w.int64(-1), -1);
  span('producerEpoch', () => w.int16(-1), -1);
  span('baseSequence', () => w.int32(-1), -1);
  span('recordCount', () => w.int32(records.length), records.length);

  records.forEach((r, i) => {
    const key = r.key === null ? null : utf8(r.key);
    const value = r.value === null ? null : utf8(r.value);
    const body = new ByteWriter();
    const parts: { field: RecordField; bytes: number[] | Uint8Array; value: unknown }[] = [
      { field: 'attributes', bytes: [0], value: 0 },
      { field: 'timestampDelta', bytes: varint(r.timestamp - baseTs), value: r.timestamp - baseTs },
      { field: 'offsetDelta', bytes: varint(i), value: i },
      { field: 'keyLength', bytes: varint(key ? key.length : -1), value: key ? key.length : -1 },
      ...(key ? [{ field: 'key' as const, bytes: key, value: r.key }] : []),
      {
        field: 'valueLength',
        bytes: varint(value ? value.length : -1),
        value: value ? value.length : -1,
      },
      ...(value ? [{ field: 'value' as const, bytes: value, value: r.value }] : []),
      { field: 'headerCount', bytes: varint(0), value: 0 },
    ];
    for (const p of parts) body.raw(p.bytes);
    span('length', () => w.raw(varint(body.length)), body.length, i);
    for (const p of parts) span(p.field, () => w.raw(p.bytes), p.value, i);
  });

  const length = w.length - LOG_OVERHEAD;
  w.patchInt32(8, length);
  const bytes = w.bytes();
  const crc = crc32c(bytes, CRC_START);
  w.patchInt32(17, crc);
  const out = w.bytes();
  for (const f of fields) {
    if (f.field === 'batchLength' && f.record === undefined) f.value = String(length);
    if (f.field === 'crc' && f.record === undefined) f.value = crc.toString(16).padStart(8, '0');
  }
  return { bytes: out, fields };
}

export interface DecodedBatch {
  baseOffset: number;
  length: number;
  leaderEpoch: number;
  crcOk: boolean;
  records: (RecordInput & { offset: number })[];
}

/** True when the batch at `pos` is complete and its CRC matches. */
export function batchIsValid(log: Uint8Array, pos: number): boolean {
  if (pos + LOG_OVERHEAD > log.length) return false;
  const end = pos + LOG_OVERHEAD + readInt32(log, pos + 8);
  if (end > log.length || end < pos + BATCH_HEADER_BYTES) return false;
  return readUint32(log, pos + 17) === crc32c(log, pos + CRC_START, end);
}

/** Read the batch at `pos`. Throws if it runs past the end of `log`. */
export function decodeBatch(log: Uint8Array, pos: number): DecodedBatch {
  const baseOffset = readInt64(log, pos);
  const length = readInt32(log, pos + 8);
  const end = pos + LOG_OVERHEAD + length;
  if (end > log.length) throw new RangeError('batch runs past the end of the file');
  const baseTs = readInt64(log, pos + 27);
  const count = readInt32(log, pos + 57);
  const records: DecodedBatch['records'] = [];
  let p = pos + BATCH_HEADER_BYTES;
  const v = () => {
    const r = readVarint(log, p);
    p += r.size;
    return r.value;
  };
  const str = (n: number) => {
    if (n < 0) return null;
    const s = fromUtf8(log.subarray(p, p + n));
    p += n;
    return s;
  };
  for (let i = 0; i < count && p < end; i++) {
    v(); // length
    readInt8(log, p);
    p += 1;
    const tsDelta = v();
    const offsetDelta = v();
    const key = str(v());
    const value = str(v());
    const headers = v();
    for (let h = 0; h < headers; h++) {
      str(v());
      str(v());
    }
    records.push({ offset: baseOffset + offsetDelta, key, value, timestamp: baseTs + tsDelta });
  }
  return {
    baseOffset,
    length,
    leaderEpoch: readInt32(log, pos + 12),
    crcOk: batchIsValid(log, pos),
    records,
  };
}

export const batchEnd = (log: Uint8Array, pos: number) =>
  pos + LOG_OVERHEAD + readInt32(log, pos + 8);
