import { describe, expect, it } from 'vitest';
import {
  appealJudges,
  appealOutcome,
  judgeCase,
  JUDGE_IDS,
  readFiling,
  resolveSnack,
  snackOutcome,
  SNACK_JUDGES,
  takesSnacks,
  type Filing,
  type SnackOutcome,
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

describe('snacks', () => {
  // Close: one more detail point for the plaintiff, nothing else apart.
  const closeA: Filing = {
    statement: 'You said you would call and you did not call me back.',
    evidence: [],
  };
  const closeB: Filing = { statement: 'I was busy.', evidence: [] };
  // Clear, but not so clear that blame sits at the 10% floor.
  const clearA: Filing = {
    statement: 'You said you would call and you did not.',
    evidence: ['Call log'],
  };

  it('only the five animal judges take snacks; the bear takes none', () => {
    expect(SNACK_JUDGES).toEqual(['tortoise', 'hare', 'cat', 'dog', 'bird']);
    expect(takesSnacks('bear')).toBe(false);
    expect(resolveSnack('bear', { A: true, B: false }, 'seed')).toBeNull();
  });

  it('do nothing when nobody or both sides offer one', () => {
    expect(resolveSnack('cat', { A: false, B: false }, 'seed')).toBeNull();
    expect(resolveSnack('cat', { A: true, B: true }, 'seed', 'accepted')).toBeNull();
  });

  it('land 2 : 1 : 1, the same way for the same seed', () => {
    const n = 4000;
    const counts: Record<SnackOutcome, number> = {
      accepted: 0,
      backfire_public: 0,
      backfire_hidden: 0,
    };
    for (let i = 0; i < n; i++) counts[snackOutcome(`case-${i}`)]++;
    expect(counts.accepted / n).toBeCloseTo(0.5, 1);
    expect(counts.backfire_public / n).toBeCloseTo(0.25, 1);
    expect(counts.backfire_hidden / n).toBeCloseTo(0.25, 1);
    expect(snackOutcome('same')).toBe(snackOutcome('same'));
    expect(resolveSnack('dog', { A: false, B: true }, 'x', 'backfire_hidden')).toEqual({
      side: 'B',
      outcome: 'backfire_hidden',
    });
  });

  it('move blame by 10 points toward or against the side that offered', () => {
    const fair = judgeCase('cat', clearA, closeB);
    expect(fair).toMatchObject({ winner: 'A', respA: 25 });
    const snack = (side: 'A' | 'B', outcome: SnackOutcome) =>
      judgeCase('cat', clearA, closeB, { side, outcome }).respA;
    expect(snack('A', 'accepted')).toBe(15);
    expect(snack('A', 'backfire_hidden')).toBe(35);
    expect(snack('A', 'backfire_public')).toBe(35);
    expect(snack('B', 'accepted')).toBe(35);
    expect(snack('B', 'backfire_hidden')).toBe(15);
  });

  it('still show in a lopsided case, without passing the 10–90 limits', () => {
    expect(judgeCase('cat', strong, weak).respA).toBe(10);
    expect(judgeCase('cat', strong, weak, { side: 'A', outcome: 'backfire_public' }).respA).toBe(
      20,
    );
    expect(judgeCase('cat', strong, weak, { side: 'A', outcome: 'accepted' }).respA).toBe(10);
  });

  it('never flip a clear case', () => {
    for (const j of SNACK_JUDGES) {
      for (const outcome of ['accepted', 'backfire_public', 'backfire_hidden'] as const) {
        for (const side of ['A', 'B'] as const) {
          expect(
            judgeCase(j, strong, weak, { side, outcome }).winner,
            `${j} ${side} ${outcome}`,
          ).toBe('A');
          expect(
            judgeCase(j, weak, strong, { side, outcome }).winner,
            `${j} ${side} ${outcome}`,
          ).toBe('B');
        }
      }
    }
  });

  it('can tip a close case, and keep the blame on the loser', () => {
    expect(judgeCase('tortoise', closeA, closeB)).toMatchObject({ winner: 'A', respA: 40 });
    const took = judgeCase('tortoise', closeA, closeB, { side: 'B', outcome: 'accepted' });
    expect(took).toMatchObject({ winner: 'draw', respA: 50 });
    const draw = judgeCase('tortoise', strong, strong, { side: 'A', outcome: 'accepted' });
    expect(draw).toMatchObject({ winner: 'A', respA: 40 });
    const lost = judgeCase('tortoise', strong, strong, { side: 'A', outcome: 'backfire_hidden' });
    expect(lost).toMatchObject({ winner: 'B', respA: 60 });
  });

  it('say so in the judgment only when they backfire in public', () => {
    const pub = judgeCase('cat', strong, weak, { side: 'B', outcome: 'backfire_public' });
    expect(pub.snackStamp).toBe('B');
    for (const outcome of ['accepted', 'backfire_hidden'] as const) {
      expect(judgeCase('cat', strong, weak, { side: 'B', outcome })).not.toHaveProperty(
        'snackStamp',
      );
    }
    expect(judgeCase('bear', strong, weak, { side: 'B', outcome: 'backfire_public' })).toEqual(
      judgeCase('bear', strong, weak),
    );
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
