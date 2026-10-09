import { describe, expect, it } from 'vitest';
import { CRITTER_SIZE, critterGrid, critterNameParts } from './critter';

describe('critters', () => {
  it('are stable per seed', () => {
    expect(critterGrid(1).grid).toEqual(critterGrid(1).grid);
    expect(critterNameParts(1)).toEqual(critterNameParts(1));
  });

  it('fit in a 12x12 grid with an outline', () => {
    const { grid } = critterGrid(123);
    expect(grid).toHaveLength(CRITTER_SIZE);
    expect(grid.flatMap((row) => [...row]).filter((v) => v === 1).length).toBeGreaterThan(10);
  });
});
