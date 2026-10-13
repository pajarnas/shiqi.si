import { useCallback, useEffect, useRef, useState } from 'react';
import type { Eventful, SimEvent } from '../simulation';
import type { Beat, BeatPicker } from '../story';

/** ready: not started. playing: simulating until the next beat. paused: a beat is on screen. */
export type StoryPhase = 'ready' | 'playing' | 'paused' | 'done';

export interface StoryGoal<S> {
  /** Simulated time to stop at, whatever happens. */
  end: number;
  /** Or stop as soon as this holds. */
  until?: (s: S) => boolean;
}

/** The stretch of simulated time one played step covered. */
export interface Span {
  start: number;
  end: number;
}

/** Simulate until `stop` holds, then call `then`. */
export type StoryRun<S> = (stop: (s: S) => boolean, then: () => void) => void;

/**
 * Plays a stretch of simulation as a story: it stops at every event the
 * picker returns a beat for and waits for `next()` before going on.
 * Everything that happened stays in `beats`, so it can be read again.
 */
export function useStory<E extends SimEvent, S extends Eventful<E>, K extends string>(
  sim: S,
  run: StoryRun<S>,
  picker: () => BeatPicker<E, S, K>,
) {
  const [phase, setPhase] = useState<StoryPhase>('ready');
  const [beats, setBeats] = useState<Beat<E, K>[]>([]);
  const [shown, setShown] = useState(0);
  const [quiet, setQuiet] = useState(0);
  /** Once done: from just before the action to where the story stopped, for replaying it. */
  const [span, setSpan] = useState<Span | null>(null);
  const startedAt = useRef(0);
  const queue = useRef<Beat<E, K>[]>([]);
  const shownRef = useRef(0);
  const filter = useRef<BeatPicker<E, S, K> | null>(null);
  const goal = useRef<StoryGoal<S> | null>(null);
  const skipping = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);

  const stopListening = () => {
    unsubscribe.current?.();
    unsubscribe.current = null;
  };
  useEffect(() => stopListening, []);

  const reached = (s: S) => {
    const g = goal.current;
    return !g || s.now >= g.end || !!g.until?.(s);
  };

  const sync = () => {
    setBeats([...queue.current]);
    setQuiet(filter.current?.quiet ?? 0);
  };

  const finish = () => {
    stopListening();
    shownRef.current = queue.current.length;
    setShown(shownRef.current);
    sync();
    setSpan({ start: startedAt.current, end: sim.now });
    setPhase('done');
  };

  /** Show the next waiting beat, or play on to the next one, or end. */
  const next = () => {
    sync();
    if (!skipping.current && shownRef.current < queue.current.length) {
      shownRef.current++;
      setShown(shownRef.current);
      setPhase('paused');
      return;
    }
    if (reached(sim)) {
      finish();
      return;
    }
    setPhase('playing');
    run((s) => reached(s) || (!skipping.current && queue.current.length > shownRef.current), next);
  };

  /** Start listening, do `act`, then play towards `target`. */
  const start = (act: () => void, target: StoryGoal<S>) => {
    stopListening();
    queue.current = [];
    shownRef.current = 0;
    const f = picker();
    filter.current = f;
    skipping.current = false;
    setShown(0);
    setSpan(null);
    startedAt.current = sim.now;
    unsubscribe.current = sim.onEvent((e) => {
      const beat = f.take(e, sim);
      if (beat) queue.current.push(beat);
    });
    act();
    goal.current = { ...target, end: Math.max(target.end, sim.now) };
    next();
  };

  /** Stop pausing and play straight to the end. */
  const skip = () => {
    skipping.current = true;
    if (phase === 'paused') next();
  };

  const reset = useCallback(() => {
    stopListening();
    queue.current = [];
    shownRef.current = 0;
    goal.current = null;
    setBeats([]);
    setShown(0);
    setQuiet(0);
    setSpan(null);
    setPhase('ready');
  }, []);

  const current = phase === 'paused' ? (beats[shown - 1] ?? null) : null;
  return { phase, beats: beats.slice(0, shown), current, quiet, span, start, next, skip, reset };
}
