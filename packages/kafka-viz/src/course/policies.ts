// Which storage functions the demos run: Kafka's, or the reader's once their
// version passes its tests. Shared by every widget on the page.
import { KAFKA_POLICIES, type PolicyName, type StoragePolicies } from '@shiqi/kafka/storage';
import { useSyncExternalStore } from 'react';

let mine: Partial<StoragePolicies> = {};
let snapshot: StoragePolicies = KAFKA_POLICIES;
const listeners = new Set<() => void>();

export function setPolicy<N extends PolicyName>(name: N, fn: StoragePolicies[N] | null) {
  if ((mine[name] ?? null) === fn) return;
  mine = { ...mine };
  if (fn) mine[name] = fn;
  else delete mine[name];
  snapshot = { ...KAFKA_POLICIES, ...mine };
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The policies the demos should use right now. */
export const useStoragePolicies = () =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => KAFKA_POLICIES,
  );

/** True when the reader's version of `name` is the one running. */
export const isMine = (policies: StoragePolicies, name: PolicyName) =>
  policies[name] !== KAFKA_POLICIES[name];
