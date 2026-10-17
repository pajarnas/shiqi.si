// The verdict fingerprint, as the Siam server computes it: SHA-256 over canonical JSON
// (keys sorted at every level), shown as a short anti-forgery code. The app also signs
// the hash with the court's Ed25519 key. The courtroom demo has no key and stops at the hash;
// verifySignature checks the server-signed samples in the verify widget.

export function canonicalJSON(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJSON).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** First 16 hex digits, upper case, in groups of four, as the server's displayCode. */
export function antiForgeryCode(hex: string): string {
  return (
    hex
      .slice(0, 16)
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') ?? ''
  );
}

/**
 * Checks the court's Ed25519 signature, which covers the hex hash string (as the server signs it).
 * Returns null when this browser's WebCrypto has no Ed25519.
 */
export async function verifySignature(
  publicKeyPem: string,
  hashHex: string,
  signatureB64: string,
): Promise<boolean | null> {
  const der = Uint8Array.from(atob(publicKeyPem.replace(/-----[^-]+-----|\s/g, '')), (c) =>
    c.charCodeAt(0),
  );
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return null;
  }
  const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
  return crypto.subtle.verify({ name: 'Ed25519' }, key, sig, new TextEncoder().encode(hashHex));
}
