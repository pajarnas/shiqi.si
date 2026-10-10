import { Exercise } from '@shiqi/code';
import type { PolicyName, StoragePolicies } from '@shiqi/kafka/storage';
import { useCallback } from 'react';
import { useKafkaStrings } from '../strings';
import { EXERCISES, reference, type ExerciseSpec } from './exercises';
import { setPolicy } from './policies';

/** Write one of Kafka's storage functions; once it passes, the demos on the page run on it. */
export function BuildExercise({ policy }: { policy: PolicyName }) {
  const t = useKafkaStrings().build;
  const spec = EXERCISES[policy] as unknown as ExerciseSpec;
  const onChange = useCallback(
    (fn: StoragePolicies[PolicyName] | null) => setPolicy(policy, fn),
    [policy],
  );
  return (
    <Exercise
      id={`kafka-build:${policy}`}
      name={policy}
      starter={spec.starter}
      solution={spec.solution}
      hints={t.hints[policy]}
      tests={spec.tests}
      reference={reference(policy)}
      onChange={onChange}
    />
  );
}
