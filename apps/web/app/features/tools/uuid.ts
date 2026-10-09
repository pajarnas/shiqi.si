// UUIDs per RFC 9562.

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function format(bytes: Uint8Array): string {
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidv4(random: (n: number) => Uint8Array = randomBytes): string {
  const b = random(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return format(b);
}

/** Version 7: 48-bit Unix milliseconds, then random bits. Sorts by creation time. */
export function uuidv7(now = Date.now(), random: (n: number) => Uint8Array = randomBytes): string {
  const b = random(16);
  let ms = now;
  for (let i = 5; i >= 0; i--) {
    b[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return format(b);
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';
export const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export interface UuidInfo {
  canonical: string;
  version: number;
  variant: 'NCS' | 'RFC 9562' | 'Microsoft' | 'Future';
  /** Embedded creation time for v1, v6 and v7. */
  time?: Date;
}

export function inspectUuid(input: string): UuidInfo | null {
  const h = input
    .trim()
    .toLowerCase()
    .replace(/^urn:uuid:/, '')
    .replace(/[{}-]/g, '');
  if (!/^[0-9a-f]{32}$/.test(h)) return null;
  const canonical = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  const version = parseInt(h[12]!, 16);
  const v = parseInt(h[16]!, 16);
  const variant = v < 8 ? 'NCS' : v < 12 ? 'RFC 9562' : v < 14 ? 'Microsoft' : 'Future';
  let time: Date | undefined;
  if (version === 7) {
    time = new Date(parseInt(h.slice(0, 12), 16));
  } else if (version === 1 || version === 6) {
    // 60-bit count of 100 ns intervals since 1582-10-15.
    const ticks =
      version === 1
        ? BigInt('0x' + h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8))
        : BigInt('0x' + h.slice(0, 12) + h.slice(13, 16));
    time = new Date(Number((ticks - 122192928000000000n) / 10000n));
  }
  return { canonical, version, variant, time };
}
