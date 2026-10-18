import { describe, expect, it } from 'vitest';
import {
  AI_LABEL_DEFAULT,
  cardLabels,
  clampLines,
  DEMO_LABEL_DEFAULT,
  TITLE_MAX_LINES,
  wrapText,
} from './card';
import { SIAM_EN, SIAM_ZH } from './strings';

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
    expect(wrapText('本喵判决：原告胜诉。', 4, mono)).toEqual(['本喵判决：', '原告胜诉。']);
  });

  it('keeps a line that already fits', () => {
    expect(wrapText('short', 20, mono)).toEqual(['short']);
  });
});

describe('clampLines', () => {
  it('keeps a 300-character title to two lines ending in an ellipsis', () => {
    const title = '谁'.repeat(300);
    const lines = clampLines(wrapText(title, 20, mono), TITLE_MAX_LINES, 20, mono);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
    for (const l of lines) expect(mono(l)).toBeLessThanOrEqual(20);
  });

  it('clamps a title with no spaces or CJK', () => {
    const lines = clampLines(wrapText('a'.repeat(300), 20, mono), 2, 20, mono);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
    for (const l of lines) expect(mono(l)).toBeLessThanOrEqual(20);
  });

  it('leaves a short title alone', () => {
    expect(clampLines(['one line'], 2, 20, mono)).toEqual(['one line']);
  });
});

describe('card labels', () => {
  it('ships the exact AI label in both languages', () => {
    expect(SIAM_EN.verdict.card.ai).toBe('AI-generated · just for fun');
    expect(SIAM_ZH.verdict?.card?.ai).toBe('AI 生成·仅供娱乐');
  });

  it('has a slogan in both languages', () => {
    expect(SIAM_EN.slogan.trim()).not.toBe('');
    expect(SIAM_ZH.slogan?.trim()).toBeTruthy();
  });

  it('falls back when a label is empty', () => {
    expect(cardLabels({ aiLabel: '  ', demoLabel: '' })).toEqual({
      ai: AI_LABEL_DEFAULT,
      demo: DEMO_LABEL_DEFAULT,
    });
    expect(AI_LABEL_DEFAULT).toBe('AI 生成·仅供娱乐');
  });
});
