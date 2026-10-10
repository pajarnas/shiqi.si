import { describe, expect, it } from 'vitest';
import { compile, CompileError, LoopLimitError, protectLoops } from './compile';
import { runTests } from './tests';

describe('protectLoops', () => {
  it('guards every braced loop and leaves strings alone', () => {
    const out = protectLoops(
      'for (let i = 0; i < 3; i++) { x(); }\nwhile (a) { b(); }\ndo { c(); } while (d);\nconst s = "while (x) {";',
    );
    expect(out.match(/__guard\.n/g)).toHaveLength(3);
    expect(out).toContain('"while (x) {"');
  });

  it('rejects a loop body without braces', () => {
    expect(() => protectLoops('while (x) y();')).toThrow(CompileError);
  });

  it('ignores words that only contain loop keywords', () => {
    expect(protectLoops('const format = done + forEach;')).toBe('const format = done + forEach;');
  });
});

describe('compile', () => {
  it('strips types and returns the named function', async () => {
    const add = await compile<(a: number, b: number) => number>(
      'function add(a: number, b: number): number { return a + b; }',
      'add',
    );
    expect(add(2, 3)).toBe(5);
  });

  it('stops an infinite loop', async () => {
    const spin = await compile<() => void>('function spin(): void { while (true) { } }', 'spin');
    expect(() => spin()).toThrow(LoopLimitError);
    expect(() => spin()).toThrow(LoopLimitError);
  });

  it('reports a missing function and syntax errors', async () => {
    await expect(compile('function other() {}', 'add')).rejects.toThrow('missing:add');
    await expect(compile('function add( {', 'add')).rejects.toBeInstanceOf(CompileError);
  });
});

describe('runTests', () => {
  it('compares with the reference when no expectation is given', () => {
    const ref = (n: number) => [n, n];
    const results = runTests((n: number) => [n, 0], [{ name: 'pair', run: (f) => f(2) }], ref);
    expect(results[0]).toMatchObject({ pass: false, got: [2, 0], expected: [2, 2] });
  });
});
