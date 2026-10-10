import type { PolicyName, StoragePolicies } from '@shiqi/kafka/storage';
import { Badge, format } from '@shiqi/ui';
import { useKafkaStrings } from '../strings';
import { isMine } from './policies';

/** Says whose version of `policy` a demo is running. */
export function RunningOn({ policies, policy }: { policies: StoragePolicies; policy: PolicyName }) {
  const t = useKafkaStrings().build;
  const mine = isMine(policies, policy);
  return (
    <p className="kvb-running">
      <Badge tone={mine ? 'green' : 'gold'}>
        {format(t.runningOn, { who: mine ? t.mine : t.kafka })}
      </Badge>{' '}
      <code>{policy}</code>
    </p>
  );
}
