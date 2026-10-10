import type { Cluster } from '@shiqi/kafka';
import { useEffect, useRef, useState } from 'react';

/** Longest simulated step per tick, so a slow frame can't skip past events. */
const MAX_STEP_MS = 50;

/**
 * Drive the cluster from requestAnimationFrame: real time × speed becomes
 * simulated time. Pauses while the tab is hidden.
 */
export function useSimulation(cluster: Cluster, running: boolean, speed: number) {
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      let dt = Math.min(250, now - last) * speedRef.current;
      last = now;
      while (dt > 0) {
        const step = Math.min(MAX_STEP_MS, dt);
        cluster.tick(step);
        dt -= step;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [cluster, running]);
}

/**
 * Re-render when the cluster changes, at most every `intervalMs`. The cluster
 * changes every frame; the DOM doesn't need to.
 */
export function useClusterVersion(cluster: Cluster, intervalMs = 120): number {
  const [, force] = useState(0);
  const lastRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = cluster.subscribe(() => {
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
  }, [cluster, intervalMs]);
  return cluster.version;
}
