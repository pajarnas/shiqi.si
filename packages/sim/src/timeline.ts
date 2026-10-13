// Rewind for a deterministic simulation. Every action taken through
// `timeline.sim` is recorded with the simulated time it happened at; to go
// back, the timeline builds the starting world again and replays the actions
// on the same fixed steps, which gives the same history bit for bit.
import type { Clocked } from './simulation';

/** Methods of S that change it from outside; everything else is read-only or internal. */
export type ActionsOf<S> = readonly (keyof S & string)[];

export interface TimelineEntry<A extends string = string> {
  at: number;
  action: A;
  args: unknown[];
}

export class Timeline<S extends Clocked, A extends keyof S & string = keyof S & string> {
  /** Recorded actions, oldest first. */
  entries: TimelineEntry<A>[] = [];
  /** What views and controls act on: a recording view of the current world. */
  sim!: S;
  private raw!: S;
  /** Entries already applied to `raw`. */
  private cursor = 0;
  private furthest = 0;
  private listeners = new Set<(s: S) => void>();
  private actions: Set<PropertyKey>;

  constructor(
    private factory: () => S,
    actions: readonly A[],
  ) {
    this.actions = new Set(actions);
    this.load();
  }

  /** The furthest simulated time this timeline has reached. */
  get end(): number {
    return Math.max(this.furthest, this.raw.now);
  }

  get now(): number {
    return this.raw.now;
  }

  /** True when looking at the past: playing on replays what was recorded. */
  get rewound(): boolean {
    return this.cursor < this.entries.length || this.raw.now < this.furthest;
  }

  /** Called with the new world whenever a rewind replaces it. */
  onReplace(fn: (s: S) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** Go to simulated time `time`: forward by running, back by replaying from the start. */
  seek(time: number) {
    this.furthest = this.end;
    const t = Math.max(0, Math.min(time, this.furthest));
    if (t < this.raw.now) {
      this.load();
      this.raw.runUntil(t);
      this.replaced();
    } else {
      this.raw.runUntil(t);
    }
  }

  /** Start over from a new starting point (a scenario), forgetting everything recorded. */
  reset(factory = this.factory) {
    this.factory = factory;
    this.entries = [];
    this.furthest = 0;
    this.load();
    this.replaced();
  }

  private replaced() {
    for (const fn of this.listeners) fn(this.sim);
  }

  private load() {
    const raw = this.factory();
    this.raw = raw;
    this.cursor = 0;
    raw.beforeStep = (now) => this.replay(now);
    const bound = new Map<PropertyKey, unknown>();
    this.sim = new Proxy(raw, {
      get: (target, prop) => {
        const value = Reflect.get(target, prop, target) as unknown;
        if (typeof value !== 'function') return value;
        let fn = bound.get(prop);
        if (!fn) {
          fn = this.actions.has(prop)
            ? (...args: unknown[]) => this.record(prop as A, args)
            : (value as (...a: unknown[]) => unknown).bind(target);
          bound.set(prop, fn);
        }
        return fn;
      },
    });
  }

  /**
   * Apply recorded actions that are due, as the replayed clock reaches them.
   * An action recorded at time t runs just before the step out of t, which is
   * when it ran live; so seek(t) shows the moment before it.
   */
  private replay(now: number) {
    while (this.cursor < this.entries.length) {
      const e = this.entries[this.cursor] as TimelineEntry<A>;
      if (e.at > now) break;
      this.cursor++;
      try {
        this.call(e.action, e.args);
      } catch {
        // It failed the same way live; nothing was recorded past the failure.
      }
    }
  }

  private call(action: A, args: unknown[]): unknown {
    const fn = this.raw[action] as (...a: unknown[]) => unknown;
    return fn.apply(this.raw, args);
  }

  private record(action: A, args: unknown[]) {
    // Acting in the past starts a new branch: the old future is dropped.
    if (this.rewound) {
      this.entries.length = this.cursor;
      this.furthest = this.raw.now;
    }
    const entry: TimelineEntry<A> = { at: this.raw.now, action, args: structuredClone(args) };
    const result = this.call(action, args);
    this.entries.push(entry);
    this.cursor = this.entries.length;
    return result;
  }
}
