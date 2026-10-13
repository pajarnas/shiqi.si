import { runCli, type Cluster } from '@shiqi/kafka';
import { Shell, type ShellHandle } from '@shiqi/ui';
import { useRef } from 'react';
import { useKafkaStrings } from '../strings';
import { CommandBuilder } from './CommandBuilder';

/** A shell for the simulated cluster, with the command builder beside it. */
export function Terminal({ cluster }: { cluster: Cluster }) {
  const t = useKafkaStrings();
  const shell = useRef<ShellHandle>(null);
  return (
    <div className="kv-console">
      <CommandBuilder
        cluster={cluster}
        onRun={(line) => shell.current?.run(line)}
        onEdit={(line) => shell.current?.edit(line)}
      />
      <Shell
        ref={shell}
        run={(line) => runCli(cluster, line)}
        resetKey={cluster}
        welcome={t.terminal.welcome}
        label={t.terminal.label}
        inputLabel={t.terminal.input}
        stopLabel={t.terminal.stop}
      />
    </div>
  );
}
