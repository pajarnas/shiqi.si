import { describe, expect, it } from 'vitest';
import { formatJson, lineColumn } from './json';

describe('formatJson', () => {
  it('pretty-prints and sorts keys deeply', () => {
    const r = formatJson('{"b":1,"a":{"d":2,"c":3}}', { indent: 2, sortKeys: true });
    expect(r).toEqual({
      ok: true,
      text: '{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}',
    });
  });

  it('minifies', () => {
    expect(formatJson('{ "a": [1, 2] }', { indent: 0 })).toEqual({ ok: true, text: '{"a":[1,2]}' });
  });

  it('reports where the error is', () => {
    const r = formatJson('{\n  "a": 1,\n}', { indent: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(3);
  });
});

describe('lineColumn', () => {
  it('is 1-based', () => {
    expect(lineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
  });
});
