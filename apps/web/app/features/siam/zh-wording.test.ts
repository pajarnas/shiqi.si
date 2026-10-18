import { describe, expect, it } from 'vitest';
import { format } from '~/i18n';
import { SNACK_JUDGES } from './court';
import { SIAM_EN, SIAM_ZH } from './strings';

describe('Chinese copy', () => {
  it('never mentions blockchain or Bitcoin', () => {
    expect(JSON.stringify(SIAM_ZH)).not.toMatch(/上链|区块|比特币|Bitcoin|blockchain|on-chain/i);
  });
});

describe('judges speak as themselves', () => {
  it('a bear verdict says 本庭, never 本喵', () => {
    const bear = SIAM_ZH.judges?.items?.bear;
    const self = bear?.self ?? '';
    expect(self).toBe('本庭');
    const ruling = bear?.voice?.ruling?.A ?? '';
    const admits = format(SIAM_ZH.jury?.admits ?? '', { self });
    for (const text of [ruling, admits]) {
      expect(text).toContain('本庭');
      expect(text).not.toContain('本喵');
    }
  });

  it('keeps 本喵 out of text every judge shares', () => {
    expect(JSON.stringify([SIAM_ZH.verdict, SIAM_ZH.jury])).not.toContain('本喵');
  });
});

describe('snack copy', () => {
  it('never calls a snack a bribe, in either language', () => {
    for (const copy of [SIAM_EN, SIAM_ZH]) {
      expect(JSON.stringify(copy)).not.toMatch(/贿赂|行贿|收买|brib/i);
    }
  });

  it('says it is just a game', () => {
    expect(SIAM_ZH.snack?.text).toMatch(/游戏/);
    expect(SIAM_ZH.snack?.text).toMatch(/不花钱/);
    expect(SIAM_EN.snack.text).toMatch(/just a game/);
    expect(SIAM_EN.snack.text).toMatch(/no money/);
  });

  it('gives every animal judge their own self-reference, and only the bear says 本庭', () => {
    const items = SIAM_ZH.judges!.items!;
    expect({
      tortoise: items.tortoise?.self,
      hare: items.hare?.self,
      cat: items.cat?.self,
      dog: items.dog?.self,
      bird: items.bird?.self,
      bear: items.bear?.self,
    }).toEqual({
      tortoise: '本龟',
      hare: '本兔',
      cat: '本喵',
      dog: '本汪',
      bird: '本啾',
      bear: '本庭',
    });
    for (const id of SNACK_JUDGES) {
      expect(JSON.stringify(items[id]), id).not.toMatch(/本庭/);
      expect(JSON.stringify(items[id]?.voice), id).toMatch(new RegExp(items[id]!.self!));
    }
  });

  it('names each judge’s snack and has a public stamp line for each', () => {
    expect(SIAM_ZH.snack?.items).toEqual({
      tortoise: '嫩生菜',
      hare: '胡萝卜',
      cat: '小鱼干',
      dog: '肉骨头',
      bird: '小米',
    });
    for (const id of SNACK_JUDGES) {
      const zh = SIAM_ZH.judges!.items![id]!.voice as { stamp?: string };
      expect(zh.stamp, id).toContain(SIAM_ZH.snack!.items![id]!);
      expect(SIAM_EN.judges.items[id].voice.stamp, id).toContain('{side}');
    }
    expect('stamp' in SIAM_EN.judges.items.bear.voice).toBe(false);
  });
});
