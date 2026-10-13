import { describe, expect, it } from 'vitest';
import { demoBroker, playScenario, SCENARIO_IDS } from './scenarios';

describe('guided stories', () => {
  for (const id of SCENARIO_IDS)
    it(`${id} plays out as its text says`, () => {
      expect(playScenario(id)).toBe(null);
    });

  it('the free-play broker keeps flowing', () => {
    const b = demoBroker();
    b.tick(20_000);
    expect(b.queue('billing').stats.acked).toBeGreaterThan(5);
    expect(b.queue('shipping').stats.acked).toBeGreaterThan(2);
    expect(b.queue('dead').ready.length).toBeGreaterThan(0);
  });
});
