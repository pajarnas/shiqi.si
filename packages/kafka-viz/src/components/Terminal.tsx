import { runCli, type CliSession, type Cluster } from '@shiqi/kafka';
import { Button } from '@shiqi/ui';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useKafkaStrings } from '../strings';
import { CommandBuilder } from './CommandBuilder';

const MAX_LINES = 400;
const POLL_MS = 100;

interface Line {
  id: number;
  text: string;
  kind: 'in' | 'out';
}

/** A shell for the simulated cluster. Up/Down walk the history; Ctrl-C stops a running producer or consumer. */
export function Terminal({ cluster }: { cluster: Cluster }) {
  const t = useKafkaStrings();
  const [lines, setLines] = useState<Line[]>(() => [
    { id: 0, text: t.terminal.welcome, kind: 'out' },
  ]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState<CliSession | null>(null);
  const history = useRef<string[]>([]);
  const cursor = useRef(0);
  const nextId = useRef(1);
  const screen = useRef<HTMLDivElement>(null);
  // A rewind swaps the cluster; a console session on the old one can't go on.
  const [owner, setOwner] = useState(cluster);
  if (owner !== cluster) {
    setOwner(cluster);
    setSession(null);
  }

  const print = (texts: string[], kind: Line['kind'] = 'out') => {
    if (!texts.length) return;
    setLines((old) =>
      [...old, ...texts.map((text) => ({ id: nextId.current++, text, kind }))].slice(-MAX_LINES),
    );
  };

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      print(session.poll());
      if (session.done) setSession(null);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight });
  }, [lines]);

  const prompt = session ? session.prompt : '$';

  /** A command for the shell, even if a console producer or consumer is running. */
  const runShell = (line: string) => {
    print([`$ ${line}`], 'in');
    if (line.trim()) {
      history.current.push(line);
      cursor.current = history.current.length;
    }
    const result = runCli(cluster, line);
    if (result.clear) setLines([]);
    print(result.lines);
    if (result.session) setSession(result.session);
  };

  const run = (line: string) => {
    if (!session) return runShell(line);
    print([`${session.prompt}${line}`], 'in');
    print(session.input(line));
    if (session.done) setSession(null);
  };

  const submit = () => {
    const line = input;
    setInput('');
    run(line);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const edit = (line: string) => {
    setInput(line);
    inputRef.current?.focus();
  };

  const interrupt = () => {
    if (!session) return;
    print(['^C', ...session.close()]);
    setSession(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if ((e.key === 'c' || e.key === 'd') && e.ctrlKey) {
      e.preventDefault();
      interrupt();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (session) return;
      e.preventDefault();
      const h = history.current;
      cursor.current = Math.max(
        0,
        Math.min(h.length, cursor.current + (e.key === 'ArrowUp' ? -1 : 1)),
      );
      setInput(h[cursor.current] ?? '');
    }
  };

  return (
    <div className="kv-console">
      <CommandBuilder
        cluster={cluster}
        onRun={(line) => {
          interrupt();
          runShell(line);
        }}
        onEdit={edit}
      />
      <div className="kv-terminal" role="group" aria-label={t.terminal.label}>
        <div className="kv-terminal__screen" ref={screen} role="log" aria-live="polite">
          {lines.map((l) => (
            <pre key={l.id} className={l.kind === 'in' ? 'kv-terminal__in' : undefined}>
              {l.text || ' '}
            </pre>
          ))}
        </div>
        <div className="kv-terminal__input">
          <span aria-hidden="true">{prompt}</span>
          <input
            ref={inputRef}
            aria-label={t.terminal.input}
            value={input}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {session && (
            <Button size="sm" variant="ghost" onClick={interrupt}>
              {t.terminal.stop}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
