import { describe, expect, it } from 'vitest';
import { contrastRatio, formatColor, parseColor } from './color';

describe('parseColor', () => {
  it('parses hex in every length', () => {
    expect(parseColor('#f2b51b')).toEqual({ r: 242, g: 181, b: 27, a: 1 });
    expect(parseColor('fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.502, 2);
  });

  it('parses rgb() and hsl() in both syntaxes', () => {
    expect(parseColor('rgb(31, 157, 85)')).toEqual({ r: 31, g: 157, b: 85, a: 1 });
    expect(parseColor('rgb(31 157 85 / 50%)')?.a).toBe(0.5);
    expect(parseColor('hsl(0 100% 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('rejects nonsense', () => {
    expect(parseColor('gold-ish')).toBeNull();
    expect(parseColor('rgb(1,2)')).toBeNull();
  });
});

describe('conversions', () => {
  it('formats white in OKLCH as 100% lightness and no chroma', () => {
    expect(formatColor({ r: 255, g: 255, b: 255, a: 1 }).oklch).toBe('oklch(100% 0 0)');
  });

  it('computes WCAG contrast', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
  });
});
