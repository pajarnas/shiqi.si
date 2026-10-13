import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { Button } from './Button';

const MAX_LINES = 400;
const POLL_MS = 100;

/** A long-running command (a console consumer): it reads lines and prints as it goes. */
export interface ShellSession {
  /** Shown before each input line; '' when input is not expected. */
  prompt: string;
  /** A line the user typed while the session runs. */
  input(line: string): string[];
  /** New output since the last call. */
  poll(): string[];
  /** Ctrl-C / Ctrl-D. Returns the goodbye lines. */
  close(): string[];
  readonly done: boolean;
}

/** What one command line printed. */
export interface ShellResult {
  lines: string[];
  session?: ShellSession;
  /** The `clear` command. */
  clear?: boolean;
}

/** Drive the shell from outside, e.g. from a command builder. */
export interface ShellHandle {
  /** Run a line as a command (stopping any running session first). */
  run(line: string): void;
  /** Put a line in the input box to edit before running. */
  edit(line: string): void;
}

export interface ShellProps {
  /** Run one command line. */
  run: (line: string) => ShellResult;
  /** First line on screen. */
  welcome: string;
  /** Accessible names. */
  label: string;
  inputLabel: string;
  /** The button that stops a running session. */
  stopLabel: string;
  /** Change it to start over with an empty screen (e.g. the world was rebuilt). */
  resetKey?: unknown;
  ref?: Ref<ShellHandle>;
}

interface Line {
  id: number;
  text: string;
  kind: 'in' | 'out';
}

/**
 * A terminal: a scrolling screen and a prompt. Up/Down walk the history;
 * Ctrl-C stops a running session.
 */
export function Shell({
  run: execute,
  welcome,
  label,
  inputLabel,
  stopLabel,
  resetKey,
  ref,
}: ShellProps) {
  const [lines, setLines] = useState<Line[]>(() => [{ id: 0, text: welcome, kind: 'out' }]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState<ShellSession | null>(null);
  const history = useRef<string[]>([]);
  const cursor = useRef(0);
  const nextId = useRef(1);
  const screen = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // A new world: a session on the old one can't go on.
  const [owner, setOwner] = useState(resetKey);
  if (owner !== resetKey) {
    setOwner(resetKey);
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

  /** A command for the shell, even if a session is running. */
  const runShell = (line: string) => {
    print([`$ ${line}`], 'in');
    if (line.trim()) {
      history.current.push(line);
      cursor.current = history.current.length;
    }
    const result = execute(line);
    if (result.clear) setLines([]);
    print(result.lines);
    if (result.session) setSession(result.session);
  };

  const interrupt = () => {
    if (!session) return;
    print(['^C', ...session.close()]);
    setSession(null);
  };

  useImperativeHandle(ref, () => ({
    run: (line) => {
      interrupt();
      runShell(line);
    },
    edit: (line) => {
      setInput(line);
      inputRef.current?.focus();
    },
  }));

  const submit = () => {
    const line = input;
    setInput('');
    if (!session) return runShell(line);
    print([`${session.prompt}${line}`], 'in');
    print(session.input(line));
    if (session.done) setSession(null);
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
    <div className="ui-shell" role="group" aria-label={label}>
      <div className="ui-shell__screen" ref={screen} role="log" aria-live="polite">
        {lines.map((l) => (
          <pre key={l.id} className={l.kind === 'in' ? 'ui-shell__in' : undefined}>
            {l.text || ' '}
          </pre>
        ))}
      </div>
      <div className="ui-shell__input">
        <span aria-hidden="true">{session ? session.prompt : '$'}</span>
        <input
          ref={inputRef}
          aria-label={inputLabel}
          value={input}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {session && (
          <Button size="sm" variant="ghost" onClick={interrupt}>
            {stopLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
