import { describe, expect, it } from 'vitest';
import {
  base64Decode,
  base64Encode,
  digest,
  hexDecode,
  hexEncode,
  urlDecode,
  urlEncode,
} from './encode';

describe('base64', () => {
  it('round-trips UTF-8', () => {
    expect(base64Encode('像素 pixel')).toBe('5YOP57SgIHBpeGVs');
    expect(base64Decode('5YOP57SgIHBpeGVs')).toBe('像素 pixel');
  });

  it('handles the URL-safe alphabet without padding', () => {
    expect(base64Encode('??>', true)).toBe('Pz8-');
    expect(base64Decode('Pz8-')).toBe('??>');
  });

  it('rejects invalid input', () => {
    expect(() => base64Decode('***')).toThrow();
  });
});

describe('url and hex', () => {
  it('round-trips', () => {
    expect(urlEncode('a b&c=金')).toBe('a%20b%26c%3D%E9%87%91');
    expect(urlDecode('a+b%26')).toBe('a b&');
    expect(hexEncode('hi')).toBe('6869');
    expect(hexDecode('0x6869')).toBe('hi');
  });
});

describe('digest', () => {
  it('matches the SHA-256 test vector for "abc"', async () => {
    expect(await digest('abc', 'SHA-256')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
