// A deterministic simulation: time moves in fixed steps, everything that
// happens is an event, and views listen for changes. Subclasses only write
// `step`; the clock, the event log and the listeners live here.

/** Every event carries the simulated time it happened at. */
export interface SimEvent {
  type: string;
  at: number;
}

const EVENT_LOG_SIZE = 400;

/** What a Timeline and the React hooks need from a simulation. */
export interface Clocked {
  now: number;
  version: number;
  beforeStep?: (now: number) => void;
  tick(ms: number): void;
  runUntil(time: number): void;
  subscribe(fn: () => void): () => void;
}

/** A simulation that also reports events, for story mode. */
export interface Eventful<E extends SimEvent> extends Clocked {
  onEvent(fn: (e: E) => void): () => void;
}

export abstract class Simulation<E extends SimEvent = SimEvent> implements Eventful<E> {
  /** Simulated milliseconds since the start. */
  now = 0;
  /** Bumped on every change; views compare it to know when to redraw. */
  version = 0;
  /** The most recent events, oldest first. */
  events: E[] = [];
  /** Called before every fixed step; a Timeline uses it to replay recorded actions on time. */
  beforeStep?: (now: number) => void;

  private carry = 0;
  private eventListeners = new Set<(e: E) => void>();
  private changeListeners = new Set<() => void>();

  /** Length of one fixed step, in simulated milliseconds. */
  protected abstract get stepMs(): number;

  /** Move the world on by one step of `ms`. `now` is already advanced. */
  protected abstract step(ms: number): void;

  /** How many recent events to keep in `events`. */
  protected get eventLogSize(): number {
    return EVENT_LOG_SIZE;
  }

  // ── Listeners ────────────────────────────────────────────────────────────

  /** Called for every event as it happens. Returns an unsubscribe function. */
  onEvent(fn: (e: E) => void) {
    this.eventListeners.add(fn);
    return () => void this.eventListeners.delete(fn);
  }

  /** Called after any change (a tick, an admin call). Fits useSyncExternalStore. */
  subscribe = (fn: () => void) => {
    this.changeListeners.add(fn);
    return () => void this.changeListeners.delete(fn);
  };

  getVersion = () => this.version;

  protected emit(event: E) {
    this.events.push(event);
    const size = this.eventLogSize;
    if (this.events.length > size) this.events.splice(0, this.events.length - size);
    for (const fn of this.eventListeners) fn(event);
  }

  protected changed() {
    this.version++;
    for (const fn of this.changeListeners) fn();
  }

  // ── Time ─────────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by `ms` of simulated time. Time moves in fixed
   * steps; a remainder waits for the next call, so the history is the same
   * whatever size the calls are.
   */
  tick(ms: number) {
    if (!(ms > 0)) return;
    this.carry += ms;
    const q = this.stepMs;
    let stepped = false;
    while (this.carry >= q - 1e-6) {
      this.carry -= q;
      this.advance(q);
      stepped = true;
    }
    if (stepped) this.changed();
  }

  /** Step until `now` reaches `time`, dropping any partial step. */
  runUntil(time: number) {
    this.carry = 0;
    const q = this.stepMs;
    let stepped = false;
    while (this.now + q <= time + 1e-6) {
      this.advance(q);
      stepped = true;
    }
    if (stepped) this.changed();
  }

  private advance(ms: number) {
    this.beforeStep?.(this.now);
    this.now += ms;
    this.step(ms);
  }
}
