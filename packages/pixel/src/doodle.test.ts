import { describe, expect, it } from 'vitest';
import { layoutDoodle } from './doodle';

describe('layoutDoodle', () => {
  it('tiles the canvas exactly, with no gaps or overlaps', () => {
    const w = 144;
    const h = 96;
    const covered = new Uint8Array(w * h);
    for (const c of layoutDoodle(9, w, h)) {
      for (let y = c.y; y < c.y + c.h; y++) {
        for (let x = c.x; x < c.x + c.w; x++) covered[y * w + x]! += 1;
      }
    }
    expect(covered.every((v) => v === 1)).toBe(true);
  });
});
