import { describe, expect, it } from 'vitest';
import { placeBox } from './useAnchoredPosition';

const view = { width: 400, height: 800 };
const box = { width: 300, height: 80 };
const at = (left: number, top: number) => ({ left, top, bottom: top + 20, width: 60, height: 20 });

describe('placeBox', () => {
  it('centres the box above the anchor when there is room', () => {
    expect(placeBox(at(170, 400), box, view)).toEqual({ top: 312, left: 50, side: 'above' });
  });

  it('slides the box right instead of past the left edge', () => {
    expect(placeBox(at(0, 400), box, view).left).toBe(8);
  });

  it('slides the box left instead of past the right edge', () => {
    expect(placeBox(at(340, 400), box, view).left).toBe(92);
  });

  it('flips below when the anchor is near the top', () => {
    expect(placeBox(at(170, 30), box, view)).toMatchObject({ top: 58, side: 'below' });
  });
});
