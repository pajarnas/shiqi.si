// Field-level encryption for everything a family member tells the helper.
// AES-256-GCM with a key derived from VISA_DATA_KEY; the database only ever
// sees ciphertext, so a leaked dump or backup reveals nothing. Lose the key and
// the data is gone too — that is the point.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

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

/** A fresh link token for one applicant: 32 random bytes, URL-safe. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the database keeps to look a token up; the token itself is never stored in the clear. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
