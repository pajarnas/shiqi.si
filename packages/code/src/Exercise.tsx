import { Button, cx, format, Segmented, useLocalStorage } from '@shiqi/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor } from './CodeEditor';
import { compile, CompileError, loadCompiler } from './compile';
import { useCodeStrings } from './strings';
import { runTests, show, type ExerciseTest, type TestResult } from './tests';

export type ExerciseSource = 'mine' | 'reference';

export interface ExerciseProps<F> {
  /** Where the reader's code is saved in localStorage. */
  id: string;
  /** The function the reader writes. */
  name: string;
  starter: string;
  /** The reference implementation's source, shown on request. */
  solution: string;
  hints?: readonly string[];
  tests: readonly ExerciseTest<F>[];
  reference: F;
  /** Which version the demo runs on, and the reader's function when it passes every test. */
  onChange?: (fn: F | null, source: ExerciseSource) => void;
  className?: string;
}

type Status =
  { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'done'; results: TestResult[] };

/**
 * Write one function, see the tests go green as you type, then plug it into
 * the demo next to it. Code compiles in the page with every loop guarded.
 */
export function Exercise<F extends (...args: never[]) => unknown>({
  id,
  name,
  starter,
  solution,
  hints = [],
  tests,
  reference,
  onChange,
  className,
}: ExerciseProps<F>) {
  const s = useCodeStrings();
  const [code, setCode] = useLocalStorage(`code:${id}`, starter);
  const [source, setSource] = useLocalStorage<ExerciseSource>(`code:${id}:use`, 'mine');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [fn, setFn] = useState<F | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const run = useRef(0);
  const report = useRef(onChange);
  useEffect(() => {
    report.current = onChange;
  });

  const check = async (text: string) => {
    const n = ++run.current;
    try {
      const compiled = await compile<F>(text, name);
      if (n !== run.current) return;
      const results = runTests(compiled, tests, reference);
      setStatus({ kind: 'done', results });
      setFn(() => (results.every((r) => r.pass) ? compiled : null));
    } catch (e) {
      if (n !== run.current) return;
      setFn(null);
      setStatus({ kind: 'error', message: errorText(e, s, name) });
    }
  };

  // Re-check shortly after the reader stops typing.
  useEffect(() => {
    const t = setTimeout(() => void check(code), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the code changes
  }, [code]);

  useEffect(() => {
    void loadCompiler();
  }, []);

  const passing = !!fn;
  const using: ExerciseSource = passing && source === 'mine' ? 'mine' : 'reference';
  useEffect(() => {
    report.current?.(using === 'mine' ? fn : null, using);
  }, [fn, using]);

  const results = status.kind === 'done' ? status.results : [];
  const passed = results.filter((r) => r.pass).length;
  const useOptions = useMemo(
    () => [
      { value: 'mine' as const, label: s.mine },
      { value: 'reference' as const, label: s.kafka },
    ],
    [s],
  );

  return (
    <section className={cx('code-exercise', className)}>
      <CodeEditor value={code} onChange={setCode} onRun={() => void check(code)} />
      <div className="code-exercise__bar">
        <Button size="sm" onClick={() => void check(code)}>
          {s.run}
        </Button>
        {hints.length > 0 && hintsShown < hints.length && (
          <Button size="sm" variant="ghost" onClick={() => setHintsShown((n) => n + 1)}>
            {s.hint}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowSolution((v) => !v)}>
          {showSolution ? s.hideSolution : s.solution}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm(s.resetConfirm)) setCode(starter);
          }}
        >
          {s.reset}
        </Button>
      </div>

      {hints.slice(0, hintsShown).map((h, i) => (
        <p key={i} className="code-exercise__hint">
          <b>{format(s.hintN, { n: i + 1, total: hints.length })}</b> {h}
        </p>
      ))}

      {showSolution && <pre className="code-exercise__solution">{solution}</pre>}

      <div className="code-exercise__results" aria-live="polite">
        {status.kind === 'error' && <p className="code-exercise__error">{status.message}</p>}
        {status.kind === 'done' && (
          <>
            <p className={cx('code-exercise__summary', passing && 'code-exercise__summary--ok')}>
              {passing
                ? format(s.allPassed, { total: results.length })
                : format(s.passed, { n: passed, total: results.length })}
            </p>
            <ul className="code-exercise__tests">
              {results.map((r) => (
                <li key={r.name} data-pass={r.pass}>
                  <span aria-hidden="true">{r.pass ? '✓' : '✗'}</span> {r.name}
                  {!r.pass && (
                    <span className="code-exercise__why">
                      {r.error
                        ? format(s.threw, { error: r.error })
                        : `${format(s.got, { got: show(r.got) })}, ${format(s.expected, {
                            expected: show(r.expected),
                          })}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="code-exercise__use">
        {passing ? (
          <Segmented label={s.use} options={useOptions} value={using} onChange={setSource} />
        ) : (
          <p className="code-exercise__note">{s.notReady}</p>
        )}
      </div>
    </section>
  );
}

function errorText(e: unknown, s: ReturnType<typeof useCodeStrings>, name: string) {
  if (e instanceof CompileError) {
    if (e.message === 'unbraced-loop') return s.errors['unbraced-loop'];
    if (e.message.startsWith('missing:')) return format(s.errors.missing, { name });
    return e.line
      ? format(s.errors.compile, { line: e.line, message: e.message })
      : format(s.errors.compileNoLine, { message: e.message });
  }
  return format(s.errors.compileNoLine, { message: (e as Error).message });
}
