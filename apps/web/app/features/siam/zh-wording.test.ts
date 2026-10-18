import { describe, expect, it } from 'vitest';
import { format } from '~/i18n';
import { SIAM_ZH } from './strings';

describe('Chinese copy', () => {
  it('never mentions blockchain or Bitcoin', () => {
    expect(JSON.stringify(SIAM_ZH)).not.toMatch(/上链|区块|比特币|Bitcoin|blockchain|on-chain/i);
  });
});

describe('judges speak as themselves', () => {
  it('a bear verdict says 本熊, never 本喵', () => {
    const self = SIAM_ZH.judges?.items?.bear?.self ?? '';
    const ruling = format(SIAM_ZH.verdict?.ruling?.A ?? '', { self });
    expect(ruling).toContain('本熊');
    expect(ruling).not.toContain('本喵');
  });

  it('keeps 本喵 out of text every judge shares', () => {
    expect(JSON.stringify([SIAM_ZH.verdict, SIAM_ZH.jury])).not.toContain('本喵');
  });
});
