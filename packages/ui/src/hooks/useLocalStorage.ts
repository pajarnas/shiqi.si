import { useCallback, useEffect, useState } from 'react';

/**
 * State mirrored to localStorage under `key`. Starts at `initial` on the server
 * and during hydration, then loads the stored value. Storage errors are ignored.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loading external state after hydration
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* private mode or corrupt value: keep the initial value */
    }
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage full or blocked */
      }
    },
    [key],
  );

  return [value, set];
}
