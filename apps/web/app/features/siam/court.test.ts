import { describe, expect, it } from 'vitest';
import {
  appealJudges,
  appealOutcome,
  judgeCase,
  JUDGE_IDS,
  readFiling,
  type Filing,
} from './court';
import { antiForgeryCode, canonicalJSON, sha256Hex } from './fingerprint';

const strong: Filing = {
  statement:
    'We agreed in March to take turns with the dishes, one night each. Monday and Tuesday were my nights and I did both. Wednesday was yours and the pan is still in the sink.',
  evidence: ['Photo of the sink on Thursday morning', 'Chat from March: "ok, turns it is"'],
};
const weak: Filing = { statement: 'You ALWAYS say that. I never get a break.', evidence: [] };

describe('readFiling', () => {
  it('counts evidence, detail, sweeping words, admissions and agreements', () => {
    expect(readFiling(strong)).toEqual({
      evidence: 2,
      detail: 2,
      absolutes: 0,
      admits: 0,
      agreement: true,
    });
    expect(readFiling(weak)).toMatchObject({ evidence: 0, detail: 1, absolutes: 2 });
  });

  it('reads Chinese statements too', () => {
    const s = readFiling({
      statement: '对不起，我忘了。但你每次都这样说，我们说好轮流的。',
      evidence: [],
    });
    expect(s).toMatchObject({ absolutes: 1, admits: 2, agreement: true });
  });

  it('ignores blank evidence and caps it at nine', () => {
    expect(readFiling({ statement: '', evidence: ['', ' '] }).evidence).toBe(0);
    expect(readFiling({ statement: '', evidence: Array(12).fill('x') }).evidence).toBe(9);
  });
});

describe('judgeCase', () => {
  it('rules for the side with evidence and an agreement, whichever judge sits', () => {
    for (const j of JUDGE_IDS) {
      expect(judgeCase(j, strong, weak).winner, j).toBe('A');
      expect(judgeCase(j, weak, strong).winner, j).toBe('B');
    }
  });

  it('keeps blame in 5% steps between 10 and 90, and on the loser', () => {
    const v = judgeCase('cat', strong, weak);
    expect(v.respA % 5).toBe(0);
    expect(v.respA).toBeGreaterThanOrEqual(10);
    expect(v.respA).toBeLessThan(50);
  });

  it('calls a draw on mirror-image filings', () => {
    const v = judgeCase('tortoise', strong, strong);
    expect(v).toMatchObject({ winner: 'draw', respA: 50 });
  });

  it('lets each judge write a different number of findings', () => {
    expect(judgeCase('hare', strong, weak).findings).toHaveLength(1);
    expect(judgeCase('tortoise', strong, weak).findings.length).toBeGreaterThan(1);
  });

  it('is deterministic', () => {
    expect(judgeCase('bird', strong, weak)).toEqual(judgeCase('bird', strong, weak));
  });
});

describe('appeals', () => {
  it('go to a different judge', () => {
    expect(appealJudges('bear')).not.toContain('bear');
    expect(appealJudges('bear')).toHaveLength(5);
  });

  it('name the outcome', () => {
    const first = judgeCase('cat', strong, weak);
    expect(appealOutcome(first, first)).toBe('upheld');
    expect(appealOutcome(first, judgeCase('cat', weak, strong))).toBe('reversed');
    expect(appealOutcome(first, { ...first, winner: 'draw', respA: 50 })).toBe('partial');
  });
});

describe('fingerprint', () => {
  it('sorts keys at every level and drops undefined', () => {
    expect(canonicalJSON({ b: 1, a: { d: [2, { z: 1, y: 0 }], c: undefined } })).toBe(
      '{"a":{"d":[2,{"y":0,"z":1}]},"b":1}',
    );
  });

  it('hashes with SHA-256 and shortens to an anti-forgery code', async () => {
    const hex = await sha256Hex('abc');
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(antiForgeryCode(hex)).toBe('BA78-16BF-8F01-CFEA');
  });
});
