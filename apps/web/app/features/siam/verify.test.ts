import { describe, expect, it } from 'vitest';
import { antiForgeryCode, canonicalJSON, sha256Hex, verifySignature } from './fingerprint';
import { DEMO_PUBLIC_KEY, SAMPLES } from './verify-sample';

describe('sample verdicts', () => {
  for (const [lang, s] of Object.entries(SAMPLES)) {
    it(`${lang}: hash, code and signature match the document, as the server made them`, async () => {
      const hash = await sha256Hex(canonicalJSON(s.document));
      expect(hash).toBe(s.hash);
      expect(antiForgeryCode(hash)).toBe(s.code);
      expect(await verifySignature(DEMO_PUBLIC_KEY, hash, s.signature)).toBe(true);
    });

    it(`${lang}: one changed character breaks both`, async () => {
      const doc = { ...s.document, sentence: `${s.document.sentence} ` };
      const hash = await sha256Hex(canonicalJSON(doc));
      expect(hash).not.toBe(s.hash);
      expect(await verifySignature(DEMO_PUBLIC_KEY, hash, s.signature)).toBe(false);
    });
  }
});
