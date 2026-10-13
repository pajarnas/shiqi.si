import { describe, expect, it } from 'vitest';
import { placeMarks } from './StepScrubber';

describe('placeMarks', () => {
  it('keeps marks far apart on one row', () => {
    expect(placeMarks([0, 500, 1000], 0, 1000).map((p) => p.row)).toEqual([0, 0, 0]);
  });

  it('moves a mark that would cover the one before to the next free row', () => {
    const placed = placeMarks([100, 120, 130, 600], 0, 1000);
    expect(placed.map((p) => p.row)).toEqual([0, 1, 2, 0]);
    expect(placed[3]?.x).toBe(0.6);
  });
});
