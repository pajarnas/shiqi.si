import { describe, expect, it } from 'vitest';
import { addMonths, ds160Date, parseDate } from './dates';

describe('visa dates', () => {
  it('reads common ways of writing a date', () => {
    expect(parseDate('1960年3月5日')).toBe('1960-03-05');
    expect(parseDate('1960/3/5')).toBe('1960-03-05');
    expect(parseDate('1960-03-05')).toBe('1960-03-05');
    expect(parseDate('5 March 1960')).toBe('1960-03-05');
    expect(parseDate('Mar 5, 1960')).toBe('1960-03-05');
    expect(parseDate('1961-02-29')).toBeNull();
    expect(parseDate('soon')).toBeNull();
  });

  it('formats for the DS-160 and adds months', () => {
    expect(ds160Date('1960-03-05')).toBe('05 MAR 1960');
    expect(addMonths('2027-08-31', 6)).toBe('2028-02-29');
    expect(addMonths('2027-05-01', 6)).toBe('2027-11-01');
  });
});
