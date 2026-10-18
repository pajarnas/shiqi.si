import { describe, expect, it } from 'vitest';
import { SIAM_ZH } from './strings';

describe('Chinese copy', () => {
  it('never mentions blockchain or Bitcoin', () => {
    expect(JSON.stringify(SIAM_ZH)).not.toMatch(/上链|区块|比特币|Bitcoin|blockchain|on-chain/i);
  });
});
