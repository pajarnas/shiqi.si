import { useEffect, useMemo, useRef, useState } from 'react';
import type { Span, StoryRun } from './useStory';

/** What a loop needs from whoever runs the simulation. */
export interface LoopDriver<S> {
  /** Simulated now. */
  now: () => number;
  /** Simulate until `stop` holds, then call `then`. */
  run: StoryRun<S>;
  /** Stop running. */
  stop: () => void;
  /** Go to a simulated time (back by rewinding). */
  seek: (time: number) => void;
}

export interface LoopOptions {
  /** Go round again at the end, and start by itself once there is a span. */
  loop?: boolean;
  /** Real milliseconds to hold the last moment before going round (and before starting by itself). */
  holdMs?: number;
}

const HOLD_MS = 1500;

/**
 * Plays one span of simulated time again, like a short video: play, pause,
 * drag to any moment, and go round and round when `loop` is on. The span
 * must already have been played once, so replaying it is a rewind.
 */
export function useLoop<S extends { now: number }>(
  driver: LoopDriver<S>,
  span: Span | null,
  { loop = true, holdMs = HOLD_MS }: LoopOptions = {},
) {
  const [playing, setPlaying] = useState(false);
  const live = useRef({ driver, span, loop, playing: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    live.current.driver = driver;
    live.current.span = span;
    live.current.loop = loop;
  });

  const api = useMemo(() => {
    const clear = () => {
      clearTimeout(timer.current);
      timer.current = undefined;
    };
    const set = (on: boolean) => {
      live.current.playing = on;
      setPlaying(on);
    };
    /** Play on from here to the end of the span. */
    const runToEnd = () => {
      const { driver: d, span: sp } = live.current;
      if (!sp) return;
      if (d.now() >= sp.end) ended();
      else d.run((s) => s.now >= sp.end, ended);
    };
    /** At the end: hold the last moment, then go round, or stop. */
    const ended = () => {
      clear();
      if (!live.current.loop) {
        set(false);
        return;
      }
      timer.current = setTimeout(() => {
        const { driver: d, span: sp, playing: on } = live.current;
        if (!on || !sp) return;
        d.seek(sp.start);
        runToEnd();
      }, holdMs);
    };
    const play = () => {
      const { driver: d, span: sp } = live.current;
      if (!sp) return;
      clear();
      set(true);
      if (d.now() >= sp.end) d.seek(sp.start);
      runToEnd();
    };
    const pause = () => {
      clear();
      if (live.current.playing) live.current.driver.stop();
      set(false);
    };
    /** Go to `time` inside the span; keeps playing if it was. */
    const seek = (time: number) => {
      const { driver: d, span: sp, playing: on } = live.current;
      if (!sp) return;
      clear();
      d.seek(Math.max(sp.start, Math.min(time, sp.end)));
      if (on) runToEnd();
    };
    return { play, pause, seek, dispose: clear };
  }, [holdMs]);

  useEffect(() => api.dispose, [api]);

  // Start by itself once there is something to loop, after letting the end sink in.
  const key = span ? `${span.start}:${span.end}` : '';
  useEffect(() => {
    if (!key || !loop) return;
    const timer = setTimeout(api.play, holdMs);
    return () => clearTimeout(timer);
  }, [key, loop, api, holdMs]);

  return { playing, play: api.play, pause: api.pause, seek: api.seek };
}
