// The lab's hooks are @shiqi/sim's, typed for the cluster.
import { Timeline, type Cluster } from '@shiqi/kafka';
import { useSimVersion, useTimeline as useSimTimeline } from '@shiqi/sim/react';

export { useSimulation, type SimulationOptions } from '@shiqi/sim/react';

/** Re-render when the cluster changes, at most every `intervalMs`. */
export const useClusterVersion = (cluster: Cluster, intervalMs = 120) =>
  useSimVersion(cluster, intervalMs);

/**
 * A timeline over clusters made by `factory`, and the cluster to show: it
 * changes when a rewind rebuilds the history.
 */
export function useTimeline(factory: () => Cluster) {
  const { timeline, sim } = useSimTimeline<Cluster, Timeline>(() => new Timeline(factory));
  return { timeline, cluster: sim };
}
