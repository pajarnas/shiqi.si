// Rewind for a deterministic cluster. Every action taken through
// `timeline.cluster` is recorded with the simulated time it happened at; to go
// back, the timeline builds the starting cluster again and replays the actions
// on the same fixed steps, which gives the same history bit for bit.
import type { Cluster } from './cluster';

/** Cluster methods that change it from outside. Everything else is read-only or internal. */
export const TIMELINE_ACTIONS = [
  'addBroker',
  'stopBroker',
  'startBroker',
  'restartBroker',
  'flushBroker',
  'setBrokerSlow',
  'configure',
  'createTopic',
  'deleteTopic',
  'addPartitions',
  'setTopicConfig',
  'preferredElection',
  'produce',
  'addProducer',
  'updateProducer',
  'removeProducer',
  'addConsumer',
  'removeConsumer',
  'crashConsumer',
  'updateConsumer',
  'deleteGroup',
  'commitOffsets',
] as const satisfies readonly (keyof Cluster)[];

export type TimelineAction = (typeof TIMELINE_ACTIONS)[number];

export interface TimelineEntry {
  at: number;
  action: TimelineAction;
  args: unknown[];
}

const ACTIONS = new Set<PropertyKey>(TIMELINE_ACTIONS);

export class Timeline {
  /** Recorded actions, oldest first. */
  entries: TimelineEntry[] = [];
  /** What views and controls act on: a recording view of the current cluster. */
  cluster!: Cluster;
  private raw!: Cluster;
  /** Entries already applied to `raw`. */
  private cursor = 0;
  private furthest = 0;
  private listeners = new Set<(c: Cluster) => void>();

  constructor(private factory: () => Cluster) {
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

  /** Called with the new cluster whenever a rewind replaces it. */
  onReplace(fn: (c: Cluster) => void) {
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
    for (const fn of this.listeners) fn(this.cluster);
  }

  private load() {
    const raw = this.factory();
    this.raw = raw;
    this.cursor = 0;
    raw.beforeStep = (now) => this.replay(now);
    const bound = new Map<PropertyKey, unknown>();
    this.cluster = new Proxy(raw, {
      get: (target, prop) => {
        const value = Reflect.get(target, prop, target) as unknown;
        if (typeof value !== 'function') return value;
        let fn = bound.get(prop);
        if (!fn) {
          fn = ACTIONS.has(prop)
            ? (...args: unknown[]) => this.record(prop as TimelineAction, args)
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
      const e = this.entries[this.cursor] as TimelineEntry;
      if (e.at > now) break;
      this.cursor++;
      try {
        this.call(e.action, e.args);
      } catch {
        // It failed the same way live; nothing was recorded past the failure.
      }
    }
  }

  private call(action: TimelineAction, args: unknown[]): unknown {
    const fn = this.raw[action] as (...a: unknown[]) => unknown;
    return fn.apply(this.raw, args);
  }

  private record(action: TimelineAction, args: unknown[]) {
    // Acting in the past starts a new branch: the old future is dropped.
    if (this.rewound) {
      this.entries.length = this.cursor;
      this.furthest = this.raw.now;
    }
    const entry: TimelineEntry = { at: this.raw.now, action, args: structuredClone(args) };
    const result = this.call(action, args);
    this.entries.push(entry);
    this.cursor = this.entries.length;
    return result;
  }
}
