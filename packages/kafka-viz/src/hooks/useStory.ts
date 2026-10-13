// Story mode over the cluster: @shiqi/sim's useStory with the Kafka beat filter.
import type { Cluster } from '@shiqi/kafka';
import { useStory as useSimStory, type StoryRun } from '@shiqi/sim/react';
import { BeatFilter } from '../story';

export type { StoryGoal, StoryPhase } from '@shiqi/sim/react';

const picker = () => new BeatFilter();

export const useStory = (cluster: Cluster, run: StoryRun<Cluster>) =>
  useSimStory(cluster, run, picker);
