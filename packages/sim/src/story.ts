// Story mode for guided scenarios: the simulation stops at every event worth
// explaining, so a reader sees one thing happen at a time with words for it.
// Steady traffic (the same kind of thing again, in the same place) only stops
// the first time.
import type { SimEvent } from './simulation';

export interface Beat<E extends SimEvent = SimEvent, K extends string = string> {
  /** Which text explains it. */
  kind: K;
  event: E;
  /** On-screen things this beat is about (anchor ids). */
  focus: string[];
}

export interface BeatRules<E extends SimEvent, S, K extends string> {
  /** Which text explains this event; null for events a story never stops for. */
  kind: (e: E) => K | null;
  /** Kinds that are steady traffic: explained once per `repeatKey`, then let through. */
  repeating: ReadonlySet<K>;
  /** What makes two repeating events "the same thing again". */
  repeatKey: (kind: K, e: E) => string;
  /** The on-screen things an event is about. */
  focus: (e: E, sim: S) => string[];
  /** Events that are never worth a stop although they have a kind. */
  boring?: (e: E) => boolean;
}

/** Something that picks the events to stop at. */
export interface BeatPicker<E extends SimEvent, S, K extends string = string> {
  /** Events that went by without a stop. */
  quiet: number;
  take(e: E, sim: S): Beat<E, K> | null;
}

/**
 * Picks the events to stop at during one scenario step. Feed it every event in
 * order; it returns a beat for the ones worth a pause and counts the rest.
 */
export class BeatFilter<E extends SimEvent, S, K extends string> implements BeatPicker<E, S, K> {
  private seen = new Set<string>();
  quiet = 0;

  constructor(private rules: BeatRules<E, S, K>) {}

  take(e: E, sim: S): Beat<E, K> | null {
    const kind = this.rules.kind(e);
    if (!kind) return null;
    if (this.rules.boring?.(e)) {
      this.quiet++;
      return null;
    }
    if (this.rules.repeating.has(kind)) {
      const key = this.rules.repeatKey(kind, e);
      if (this.seen.has(key)) {
        this.quiet++;
        return null;
      }
      this.seen.add(key);
    }
    return { kind, event: e, focus: this.rules.focus(e, sim) };
  }
}

/** Event fields as template values: numbers stay, lists join, nested objects flatten, the rest become text. */
export const eventVars = (e: object): Record<string, string | number> =>
  Object.fromEntries(
    Object.entries(e).flatMap(([k, v]) =>
      v !== null && typeof v === 'object' && !Array.isArray(v)
        ? Object.entries(v as object).map(([k2, v2]) => [k2, String(v2 ?? '')])
        : [[k, typeof v === 'number' ? v : Array.isArray(v) ? v.join(', ') : String(v ?? '')]],
    ),
  );

/** kebab-case event type to camelCase beat kind. */
export const camel = <T extends string>(s: string) =>
  s.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as T;
