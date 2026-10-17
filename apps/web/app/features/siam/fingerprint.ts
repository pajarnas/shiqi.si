// The verdict fingerprint, as the Siam server computes it: SHA-256 over canonical JSON
// (keys sorted at every level), shown as a short anti-forgery code. The app also signs
// the hash with the court's Ed25519 key; the demo has no key, so it stops at the hash.

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

/** First 12 hex digits, upper case, in groups of four: "3F2A-91C0-7B44". */
export function antiForgeryCode(hex: string): string {
  return (
    hex
      .slice(0, 12)
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') ?? ''
  );
}
