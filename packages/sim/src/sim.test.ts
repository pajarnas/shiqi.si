import { describe, expect, it } from 'vitest';
import { Simulation, type SimEvent } from './simulation';
import { BeatFilter } from './story';
import { Timeline } from './timeline';

type Ev = SimEvent & { type: 'beep' | 'note'; n: number };

class Counter extends Simulation<Ev> {
  n = 0;
  rate = 1;
  protected override get stepMs() {
    return 100;
  }
  protected override step() {
    this.n += this.rate;
    if (this.n % 5 === 0) this.emit({ type: 'beep', at: this.now, n: this.n });
  }
  setRate(r: number) {
    this.rate = r;
    this.emit({ type: 'note', at: this.now, n: r });
  }
}

describe('Simulation', () => {
  it('steps in fixed sizes whatever the tick sizes', () => {
    const a = new Counter();
    const b = new Counter();
    a.tick(1000);
    for (let i = 0; i < 40; i++) b.tick(25);
    expect(a.n).toBe(10);
    expect(b.n).toBe(10);
    expect(a.events).toEqual(b.events);
  });
});

describe('Timeline', () => {
  it('records actions and replays them on rewind', () => {
    const t = new Timeline(() => new Counter(), ['setRate'] as const);
    t.sim.tick(500);
    t.sim.setRate(5);
    t.sim.tick(500);
    const n = t.sim.n;
    t.seek(200);
    expect(t.sim.n).toBe(2);
    t.seek(1000);
    expect(t.sim.n).toBe(n);
  });
});

describe('BeatFilter', () => {
  it('stops once per repeat key and counts the rest', () => {
    const f = new BeatFilter<Ev, Counter, 'beep' | 'note'>({
      kind: (e) => e.type,
      repeating: new Set(['beep']),
      repeatKey: (k) => k,
      focus: () => [],
    });
    const c = new Counter();
    const beeps = [5, 10, 15].map((n) => f.take({ type: 'beep', at: 0, n }, c));
    expect(beeps.filter(Boolean)).toHaveLength(1);
    expect(f.quiet).toBe(2);
  });
});
