import { describe, expect, it } from 'vitest';
import { isoWeek, parseInstant, relative } from './time';

describe('parseInstant', () => {
  it('reads seconds, milliseconds and ISO strings', () => {
    expect(parseInstant('1760000000')?.date.toISOString()).toBe('2025-10-09T08:53:20.000Z');
    expect(parseInstant('1760000000000')?.kind).toBe('unix-ms');
    expect(parseInstant('2026-10-09T03:13:14Z')?.date.getTime()).toBe(
      Date.UTC(2026, 9, 9, 3, 13, 14),
    );
  });

  it('rejects garbage', () => {
    expect(parseInstant('')).toBeNull();
    expect(parseInstant('not a date')).toBeNull();
  });
});

describe('isoWeek', () => {
  it('follows ISO 8601 edge cases', () => {
    expect(isoWeek(new Date(2026, 0, 1)).label).toBe('2026-W01-4');
    expect(isoWeek(new Date(2021, 0, 1)).label).toBe('2020-W53-5');
    expect(isoWeek(new Date(2024, 11, 30)).label).toBe('2025-W01-1');
  });
});

describe('relative', () => {
  it('picks a sensible unit', () => {
    const now = new Date(2026, 9, 9, 12);
    expect(relative(new Date(2026, 9, 6, 12), now, 'zh-CN')).toBe('3天前');
    expect(relative(new Date(2026, 9, 6, 12), now)).toBe('3 days ago');
  });
});
