import type { Cluster } from '@shiqi/kafka';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BeatFilter, type Beat } from '../story';

/** ready: not started. playing: simulating until the next beat. paused: a beat is on screen. */
export type StoryPhase = 'ready' | 'playing' | 'paused' | 'done';

export interface StoryGoal {
  /** Simulated time to stop at, whatever happens. */
  end: number;
  /** Or stop as soon as this holds. */
  until?: (c: Cluster) => boolean;
}

export interface StoryRun {
  /** Simulate until `stop` holds, then call `then`. */
  (stop: (c: Cluster) => boolean, then: () => void): void;
}

/**
 * Plays a stretch of simulation as a story: it stops at every event worth
 * explaining (see BeatFilter) and waits for `next()` before going on.
 * Everything that happened stays in `beats`, so it can be read again.
 */
export function useStory(cluster: Cluster, run: StoryRun) {
  const [phase, setPhase] = useState<StoryPhase>('ready');
  const [beats, setBeats] = useState<Beat[]>([]);
  const [shown, setShown] = useState(0);
  const [quiet, setQuiet] = useState(0);
  const queue = useRef<Beat[]>([]);
  const shownRef = useRef(0);
  const filter = useRef(new BeatFilter());
  const goal = useRef<StoryGoal | null>(null);
  const skipping = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);

  const stopListening = () => {
    unsubscribe.current?.();
    unsubscribe.current = null;
  };
  useEffect(() => stopListening, []);

  const reached = (c: Cluster) => {
    const g = goal.current;
    return !g || c.now >= g.end || !!g.until?.(c);
  };

  const sync = () => {
    setBeats([...queue.current]);
    setQuiet(filter.current.quiet);
  };

  const finish = () => {
    stopListening();
    shownRef.current = queue.current.length;
    setShown(shownRef.current);
    sync();
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
    if (reached(cluster)) {
      finish();
      return;
    }
    setPhase('playing');
    run((c) => reached(c) || (!skipping.current && queue.current.length > shownRef.current), next);
  };

  /** Start listening, do `act`, then play towards `target`. */
  const start = (act: () => void, target: StoryGoal) => {
    stopListening();
    queue.current = [];
    shownRef.current = 0;
    filter.current = new BeatFilter();
    skipping.current = false;
    setShown(0);
    unsubscribe.current = cluster.onEvent((e) => {
      const beat = filter.current.take(e, cluster);
      if (beat) queue.current.push(beat);
    });
    act();
    goal.current = { ...target, end: Math.max(target.end, cluster.now) };
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
    setPhase('ready');
  }, []);

  const current = phase === 'paused' ? (beats[shown - 1] ?? null) : null;
  return { phase, beats: beats.slice(0, shown), current, quiet, start, next, skip, reset };
}
