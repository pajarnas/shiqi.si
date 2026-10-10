// A tiny test runner for exercises: each test calls the reader's function and
// compares the result with what the reference gives.

export interface ExerciseTest<F> {
  /** Shown to the reader, e.g. "64 needs two bytes". */
  name: string;
  /** Call the function under test and return what it produced. */
  run: (fn: F) => unknown;
  /** The expected value. Omit to compare against `run(reference)`. */
  expect?: unknown;
}

export interface TestResult {
  name: string;
  pass: boolean;
  got?: unknown;
  expected?: unknown;
  error?: string;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b) || Array.isArray(a) || Array.isArray(b)) {
    const x = [...(a as ArrayLike<unknown> as unknown[])];
    const y = [...(b as ArrayLike<unknown> as unknown[])];
    return x.length === y.length && x.every((v, i) => deepEqual(v, y[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

export function runTests<F>(fn: F, tests: readonly ExerciseTest<F>[], reference: F): TestResult[] {
  return tests.map((t) => {
    const expected = 'expect' in t ? t.expect : t.run(reference);
    try {
      const got = t.run(fn);
      return { name: t.name, pass: deepEqual(got, expected), got, expected };
    } catch (e) {
      return { name: t.name, pass: false, expected, error: (e as Error).message };
    }
  });
}

/** Short, readable form of a value for a failing test. */
export function show(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (ArrayBuffer.isView(v)) v = Array.from(v as unknown as ArrayLike<number>);
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return String(v);
  }
}
