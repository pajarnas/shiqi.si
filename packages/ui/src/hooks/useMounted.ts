import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** False on the server and during hydration, true afterwards. Use it to gate clock- or storage-dependent output. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
