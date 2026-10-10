import { describe, expect, it } from 'vitest';
import { playStep, SCENARIO_IDS, SCENARIOS } from './scenarios';

describe('scenarios', () => {
  it.each(SCENARIO_IDS)('%s plays out as its text says', (id) => {
    const s = SCENARIOS[id];
    const c = s.build();
    for (const step of s.steps) {
      playStep(c, step);
      if (step.expect) expect(step.expect(c), `${id}/${step.id}`).toBe(true);
      step.focus?.(c);
      step.vars?.(c);
    }
  });

  it('rebuild the same cluster every time', () => {
    for (const id of SCENARIO_IDS) {
      const a = SCENARIOS[id].build();
      const b = SCENARIOS[id].build();
      expect(a.allPartitions().map((p) => p.replicas)).toEqual(
        b.allPartitions().map((p) => p.replicas),
      );
    }
  });
});
