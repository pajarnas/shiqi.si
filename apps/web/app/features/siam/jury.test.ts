import { describe, expect, it } from 'vitest';
import type { Filing } from './court';
import { opinionsFor, OVERRULE_PCT, QUORUM, simulateJury, tally } from './jury';

const strong: Filing = {
  statement:
    'We agreed in March to take turns with the dishes, one night each. Monday and Tuesday were my nights and I did both. Wednesday was yours.',
  evidence: ['Photo of the sink', 'Chat from March'],
};
const weak: Filing = { statement: 'You ALWAYS say that. I never get a break.', evidence: [] };

describe('simulateJury', () => {
  it('is deterministic for a seed', () => {
    expect(simulateJury(strong, weak, 'x')).toEqual(simulateJury(strong, weak, 'x'));
  });

  it('mostly sides with the stronger filing', () => {
    const votes = simulateJury(strong, weak, 'seed', 200);
    expect(votes.filter((v) => v === 'A').length).toBeGreaterThan(150);
  });
});

describe('tally', () => {
  const many = (w: 'A' | 'B' | 'draw', n: number) => Array<typeof w>(n).fill(w);

  it('counts agreement with the ruling', () => {
    const t = tally([...many('A', 15), ...many('B', 5)], 'A');
    expect(t).toMatchObject({ votes: 20, A: 15, B: 5, draw: 0, agreePct: 75, overruled: false });
  });

  it('overrules only at quorum and a 90% majority against', () => {
    expect(tally([...many('B', 18), ...many('A', 2)], 'A').overruled).toBe(true);
    expect(tally([...many('B', 17), ...many('A', 3)], 'A').overruled).toBe(false);
    expect(tally(many('B', QUORUM - 1), 'A').overruled).toBe(false);
    expect(OVERRULE_PCT).toBe(90);
  });
});

describe('opinionsFor', () => {
  it('matches each opinion to its vote, without repeats', () => {
    const pool = { A: ['a1', 'a2'], B: ['b1'], draw: ['d1'] };
    const out = opinionsFor(['A', 'A', 'A', 'B'], pool, 's');
    expect(out.length).toBeLessThanOrEqual(3);
    for (const o of out) expect(pool[o.vote]).toContain(o.text);
    expect(new Set(out.map((o) => o.text)).size).toBe(out.length);
  });

  it('quotes the majority first, even when the minority voted first', () => {
    const pool = { A: ['a1'], B: ['b1', 'b2', 'b3'], draw: ['d1'] };
    const out = opinionsFor(['A', 'draw', 'B', 'B', 'B', 'B', 'B', 'B'], pool, 's');
    expect(out[0]?.vote).toBe('B');
  });
});
