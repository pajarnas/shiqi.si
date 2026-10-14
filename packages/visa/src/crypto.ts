// Field-level encryption for everything a family member tells the helper.
// AES-256-GCM with a key derived from VISA_DATA_KEY; the database only ever
// sees ciphertext, so a leaked dump or backup reveals nothing. Lose the key and
// the data is gone too — that is the point.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export interface Sealer {
  seal(value: unknown): string;
  open<T>(sealed: string): T;
}

const VERSION = 'v1';

/** Builds a sealer from a secret of any length (at least 16 characters). */
export function createSealer(secret: string): Sealer {
  if (secret.length < 16) throw new Error('VISA_DATA_KEY must be at least 16 characters');
  const key = createHash('sha256').update(`shiqi-visa:${secret}`).digest();
  return {
    seal(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv.toString('base64'), tag.toString('base64'), body.toString('base64')].join(
        '.',
      );
    },
    open<T>(sealed: string): T {
      const [version, iv, tag, body] = sealed.split('.');
      if (version !== VERSION || !iv || !tag || !body) throw new Error('unreadable sealed value');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      const text = Buffer.concat([
        decipher.update(Buffer.from(body, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(text) as T;
    },
  };
}

/**
 * Signs short values (the family login cookie) with a key derived from the
 * same secret, so a cookie can't be forged without VISA_DATA_KEY.
 */
export function createSigner(secret: string) {
  const key = createHash('sha256').update(`shiqi-visa-cookie:${secret}`).digest();
  const mac = (value: string) => createHmac('sha256', key).update(value).digest('base64url');
  return {
    sign: (value: string) => `${value}.${mac(value)}`,
    /** The value if the signature is right, else null. */
    verify(signed: string): string | null {
      const dot = signed.lastIndexOf('.');
      if (dot < 0) return null;
      const value = signed.slice(0, dot);
      const given = Buffer.from(signed.slice(dot + 1));
      const want = Buffer.from(mac(value));
      return given.length === want.length && timingSafeEqual(given, want) ? value : null;
    },
  };
}

/** Compares two secrets in constant time. */
export function sameSecret(a: string, b: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
