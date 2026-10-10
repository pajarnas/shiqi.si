// The byte-level building blocks of Kafka's on-disk format: big-endian
// integers, zigzag varints (as in Protocol Buffers) and CRC-32C.

/** A growable byte buffer, written front to back. */
export class ByteWriter {
  private buf: number[] = [];

  get length() {
    return this.buf.length;
  }

  bytes(): Uint8Array {
    return Uint8Array.from(this.buf);
  }

  int8(n: number) {
    this.buf.push(n & 0xff);
  }

  int16(n: number) {
    this.buf.push((n >> 8) & 0xff, n & 0xff);
  }

  int32(n: number) {
    this.buf.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  }

  /** A 64-bit integer. Values must be safe JavaScript integers (|n| < 2^53). */
  int64(n: number) {
    const hi = Math.floor(n / 2 ** 32);
    this.int32(hi);
    this.int32(n - hi * 2 ** 32);
  }

  raw(bytes: ArrayLike<number>) {
    for (let i = 0; i < bytes.length; i++) this.buf.push((bytes[i] as number) & 0xff);
  }

  /** Overwrite four bytes at `pos` (for length and CRC fields filled in last). */
  patchInt32(pos: number, n: number) {
    this.buf[pos] = (n >>> 24) & 0xff;
    this.buf[pos + 1] = (n >>> 16) & 0xff;
    this.buf[pos + 2] = (n >>> 8) & 0xff;
    this.buf[pos + 3] = n & 0xff;
  }
}

export const readInt8 = (b: Uint8Array, pos: number) => ((b[pos] as number) << 24) >> 24;
export const readInt16 = (b: Uint8Array, pos: number) =>
  ((((b[pos] as number) << 8) | (b[pos + 1] as number)) << 16) >> 16;
export const readInt32 = (b: Uint8Array, pos: number) =>
  ((b[pos] as number) << 24) |
  ((b[pos + 1] as number) << 16) |
  ((b[pos + 2] as number) << 8) |
  (b[pos + 3] as number);
export const readUint32 = (b: Uint8Array, pos: number) => readInt32(b, pos) >>> 0;
export const readInt64 = (b: Uint8Array, pos: number) =>
  readInt32(b, pos) * 2 ** 32 + readUint32(b, pos + 4);

/**
 * Zigzag-encode then write 7 bits per byte, low bits first, with the top bit
 * set on every byte but the last. Small numbers of either sign take one byte:
 * 0 → 00, -1 → 01, 1 → 02, 63 → 7e, 64 → 80 01. Same as Kafka's
 * ByteUtils.writeVarlong; works for any safe integer.
 */
export function writeVarint(value: number): number[] {
  let z = value >= 0 ? value * 2 : -value * 2 - 1;
  const out: number[] = [];
  while (z >= 0x80) {
    out.push((z % 0x80) | 0x80);
    z = Math.floor(z / 0x80);
  }
  out.push(z);
  return out;
}

/** Inverse of writeVarint: the value and how many bytes it took. */
export function readVarint(b: Uint8Array, pos: number): { value: number; size: number } {
  let z = 0;
  let scale = 1;
  let size = 0;
  for (;;) {
    if (pos + size >= b.length) throw new RangeError('varint runs past the end');
    const byte = b[pos + size] as number;
    size++;
    z += (byte & 0x7f) * scale;
    if (!(byte & 0x80)) break;
    scale *= 0x80;
    if (size > 10) throw new RangeError('varint too long');
  }
  const value = z % 2 === 0 ? z / 2 : -(z + 1) / 2;
  return { value, size };
}

const CRC32C_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32C (Castagnoli), the checksum in every record batch since Kafka 0.11. */
export function crc32c(b: Uint8Array, start = 0, end = b.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++)
    c = (CRC32C_TABLE[(c ^ (b[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const utf8 = (s: string) => encoder.encode(s);
export const fromUtf8 = (b: Uint8Array) => decoder.decode(b);

export const hex = (n: number, width = 2) => n.toString(16).padStart(width, '0');
