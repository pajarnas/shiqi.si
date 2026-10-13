// Polls a JSON endpoint while the tab is visible, for the pages that show a
// real service live (/kafka, /rabbitmq). A 503 means the service isn't
// running; a failed poll keeps the last good answer on screen.
import { useEffect, useRef, useState } from 'react';

export const POLL_MS = 2000;

export type Polled<T, D = undefined> =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; status: number }
  | { kind: 'ok'; data: T; derived: D };

/** `derive` sees the previous answer too, e.g. to turn two counters into a rate. */
export function usePolled<T, D = undefined>(
  url: string,
  derive?: (previous: T | null, next: T) => D,
  everyMs = POLL_MS,
): Polled<T, D> {
  const [state, setState] = useState<Polled<T, D>>({ kind: 'loading' });
  const last = useRef<T | null>(null);
  const deriveRef = useRef(derive);
  useEffect(() => {
    deriveRef.current = derive;
  });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch(url);
          if (stopped) return;
          if (res.status === 503) setState({ kind: 'unavailable' });
          else if (!res.ok) {
            if (!last.current) setState({ kind: 'error', status: res.status });
          } else {
            const data = (await res.json()) as T;
            if (stopped) return;
            const derived = deriveRef.current?.(last.current, data) as D;
            last.current = data;
            setState({ kind: 'ok', data, derived });
          }
        } catch {
          if (!stopped && !last.current) setState({ kind: 'error', status: 0 });
        }
      }
      if (!stopped) timer = setTimeout(() => void poll(), everyMs);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [url, everyMs]);

  return state;
}
