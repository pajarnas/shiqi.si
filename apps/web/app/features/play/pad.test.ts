import { describe, expect, it } from 'vitest';
import { PAD_SIZE, decodeGrid, emptyGrid, encodeGrid, fill, paint, toSvg } from './pad';

describe('pad', () => {
  it('mirrors strokes across the vertical axis', () => {
    const g = paint(emptyGrid(), 0, 0, 1, true);
    expect(g[0]).toBe(1);
    expect(g[PAD_SIZE - 1]).toBe(1);
  });

  it('flood-fills a bounded region only', () => {
    let g = emptyGrid();
    for (let i = 0; i < PAD_SIZE; i++) g = paint(g, 5, i, 1, false);
    g = fill(g, 0, 0, 3);
    expect(g[0]).toBe(3);
    expect(g[6]).toBe(0);
  });

  it('round-trips through storage and exports SVG runs', () => {
    const g = paint(paint(emptyGrid(), 1, 0, 2, false), 2, 0, 2, false);
    expect(decodeGrid(encodeGrid(g))).toEqual(g);
    expect(toSvg(g)).toContain('<rect x="1" y="0" width="2" height="1"');
  });
});
