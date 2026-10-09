import { describe, expect, it } from 'vitest';
import { dayOfYear, hash, isoDate, rng } from './random';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1)', () => {
    const r = rng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hash', () => {
  it('matches the FNV-1a reference value', () => {
    expect(hash('')).toBe(0x811c9dc5);
    expect(hash('a')).toBe(0xe40c292c);
  });
});

describe('dates', () => {
  it('formats local dates as ISO 8601', () => {
    expect(isoDate(new Date(2026, 9, 9))).toBe('2026-10-09');
  });

  it('counts the day of the year', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });
});
