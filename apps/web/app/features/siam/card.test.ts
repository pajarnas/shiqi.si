import { describe, expect, it } from 'vitest';
import { wrapText } from './card';

const mono = (s: string) => s.length;

describe('wrapText', () => {
  it('wraps English on spaces', () => {
    expect(wrapText('the court rules for the plaintiff', 12, mono)).toEqual([
      'the court',
      'rules for',
      'the',
      'plaintiff',
    ]);
  });

  it('wraps Chinese between characters', () => {
    expect(wrapText('今天轮到谁洗碗呢', 4, mono)).toEqual(['今天轮到', '谁洗碗呢']);
  });

  it('never starts a line with closing punctuation', () => {
    expect(wrapText('本庭判决：原告胜诉。', 4, mono)).toEqual(['本庭判决：', '原告胜诉。']);
  });

  it('keeps a line that already fits', () => {
    expect(wrapText('short', 20, mono)).toEqual(['short']);
  });
});
