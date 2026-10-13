import type { Clocked } from '@shiqi/sim';
import { useSimulation, type LoopDriver, type StoryRun } from '@shiqi/sim/react';
import { useState } from 'react';
import type { Speed } from './components/LabToolbar';

interface Goal<S> {
  until: (s: S) => boolean;
  done: () => void;
}

/**
 * Who runs a lab's simulation: free running from the toolbar, or running
 * towards a goal for a story or a replayed step. Seeking always stops it.
 */
export function useLabClock<S extends Clocked>(
  sim: S,
  timeline: { now: number; seek: (time: number) => void },
  startRunning: boolean,
) {
  const [running, setRunning] = useState(startRunning);
  const [speed, setSpeed] = useState<Speed>('1');
  const [goal, setGoal] = useState<Goal<S> | null>(null);

  useSimulation(sim, running, Number(speed), {
    stopWhen: goal?.until,
    onStop: () => {
      setRunning(false);
      setGoal(null);
      goal?.done();
    },
  });

  const run: StoryRun<S> = (until, done) => {
    setGoal({ until, done });
    setRunning(true);
  };
  const stop = () => {
    setRunning(false);
    setGoal(null);
  };
  const seek = (time: number) => {
    stop();
    timeline.seek(time);
  };
  /** Forget any goal and run freely (or not), e.g. after loading a new world. */
  const restart = (on: boolean) => {
    setGoal(null);
    setRunning(on);
  };

  const driver: LoopDriver<S> = { now: () => timeline.now, run, stop, seek };
  return { running, setRunning, speed, setSpeed, run, stop, seek, restart, driver };
}
