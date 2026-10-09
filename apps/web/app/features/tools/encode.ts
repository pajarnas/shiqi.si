// Text <-> bytes codecs. Everything is UTF-8.
// Decoders throw an Error whose message is an EncodeErrorCode; the page words it.

export type EncodeErrorCode = 'invalid-base64' | 'invalid-hex';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

function bytesToBinary(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

export function base64Encode(text: string, url = false): string {
  const b64 = btoa(bytesToBinary(enc.encode(text)));
  return url ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

/** Decodes standard or URL-safe Base64, with or without padding. Throws on invalid input. */
export function base64Decode(input: string): string {
  let s = input.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('invalid-base64');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  return dec.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const urlEncode = (text: string) => encodeURIComponent(text);
export const urlDecode = (text: string) => decodeURIComponent(text.replace(/\+/g, ' '));

export function hexEncode(text: string): string {
  return [...enc.encode(text)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexDecode(input: string): string {
  const s = input.replace(/\s+/g, '').replace(/^0x/i, '');
  if (!/^([0-9a-fA-F]{2})*$/.test(s)) throw new Error('invalid-hex');
  return dec.decode(Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16)));
}

export type ShaAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export async function digest(text: string, algorithm: ShaAlgorithm): Promise<string> {
  const buf = await crypto.subtle.digest(algorithm, enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
