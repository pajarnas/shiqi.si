import { runRabbitCli, type Broker } from '@shiqi/rabbitmq';
import { Button, Shell, type ShellHandle } from '@shiqi/ui';
import { useRef } from 'react';
import { useRabbitStrings } from '../i18n';

/** Commands worth trying first; clicking one puts it in the prompt to edit. */
const EXAMPLES = [
  'rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers',
  'rabbitmqctl list_bindings',
  'rabbitmqctl list_consumers',
  'rabbitmqadmin publish exchange=orders routing_key=order.paid payload=hi',
  'rabbitmqadmin get queue=dead count=3',
  `rabbitmqadmin declare queue name=slow arguments='{"x-message-ttl":5000,"x-dead-letter-exchange":"dlx"}'`,
];

/** A shell for the simulated broker. */
export function Terminal({ broker }: { broker: Broker }) {
  const t = useRabbitStrings();
  const shell = useRef<ShellHandle>(null);
  return (
    <div className="rv-console">
      <div className="rv-examples">
        <span className="lab-muted">{t.terminal.examples}</span>
        {EXAMPLES.map((line) => (
          <Button key={line} size="sm" variant="ghost" onClick={() => shell.current?.edit(line)}>
            <code>{line}</code>
          </Button>
        ))}
      </div>
      <Shell
        ref={shell}
        run={(line) => runRabbitCli(broker, line)}
        resetKey={broker}
        welcome={t.terminal.welcome}
        label={t.terminal.label}
        inputLabel={t.terminal.input}
        stopLabel={t.terminal.stop}
      />
    </div>
  );
}
