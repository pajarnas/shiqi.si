import { useEffect, useRef, useState } from 'react';
import type { Clocked } from '../simulation';

/** The part of a Timeline the hook needs. */
export interface Rewindable<S> {
  sim: S;
  onReplace(fn: (s: S) => void): () => void;
}

/** Longest simulated step per tick, so a slow frame can't skip past events. */
const MAX_STEP_MS = 50;

export interface SimulationOptions<S> {
  /** Stop as soon as this holds, checked after every step; then call onStop. */
  stopWhen?: ((s: S) => boolean) | null;
  onStop?: () => void;
}

/**
 * Drive a simulation from requestAnimationFrame: real time × speed becomes
 * simulated time. Pauses while the tab is hidden.
 */
export function useSimulation<S extends Clocked>(
  sim: S,
  running: boolean,
  speed: number,
  options: SimulationOptions<S> = {},
) {
  const speedRef = useRef(speed);
  const optionsRef = useRef(options);
  useEffect(() => {
    speedRef.current = speed;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      let dt = Math.min(250, now - last) * speedRef.current;
      last = now;
      const { stopWhen, onStop } = optionsRef.current;
      while (dt > 0) {
        const step = Math.min(MAX_STEP_MS, dt);
        sim.tick(step);
        dt -= step;
        if (stopWhen?.(sim)) {
          onStop?.();
          return;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [sim, running]);
}

/**
 * Re-render when the simulation changes, at most every `intervalMs`. It
 * changes every frame; the DOM doesn't need to.
 */
export function useSimVersion(sim: Clocked, intervalMs = 120): number {
  const [, force] = useState(0);
  const lastRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = sim.subscribe(() => {
      if (timerRef.current) return;
      const wait = Math.max(0, intervalMs - (performance.now() - lastRef.current));
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastRef.current = performance.now();
        force((n) => n + 1);
      }, wait);
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [sim, intervalMs]);
  return sim.version;
}

/**
 * A timeline made once by `create`, and the world to show: it changes when a
 * rewind rebuilds the history.
 */
export function useTimeline<S extends Clocked, T extends Rewindable<S>>(create: () => T) {
  const [timeline] = useState(create);
  const [sim, setSim] = useState(() => timeline.sim);
  useEffect(() => timeline.onReplace(setSim), [timeline]);
  return { timeline, sim };
}
