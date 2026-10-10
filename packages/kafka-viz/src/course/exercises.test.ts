import { compile, runTests } from '@shiqi/code';
import { KAFKA_POLICIES } from '@shiqi/kafka/storage';
import { describe, expect, it } from 'vitest';
import { EXERCISES } from './exercises';

describe('build exercises', () => {
  for (const [name, spec] of Object.entries(EXERCISES)) {
    const ref = KAFKA_POLICIES[name as keyof typeof KAFKA_POLICIES] as never;

    it(`${name}: Kafka's version passes`, () => {
      const r = runTests(ref, spec.tests as never, ref);
      expect(r.filter((x) => !x.pass)).toEqual([]);
    });

    it(`${name}: the shown solution passes`, async () => {
      const fn = await compile(spec.solution, name);
      const r = runTests(fn as never, spec.tests as never, ref);
      expect(r.filter((x) => !x.pass)).toEqual([]);
    });

    it(`${name}: the starter fails at least one test`, async () => {
      const fn = await compile(spec.starter, name);
      const r = runTests(fn as never, spec.tests as never, ref);
      expect(r.some((x) => !x.pass)).toBe(true);
    });
  }

  it('a linear lookup is too slow for the big index', async () => {
    const linear = await compile(
      `function lookup(index, target) { let f = null; for (const e of index) { if (e.offset <= target) { f = e; } } return f; }`,
      'lookup',
    );
    const r = runTests(
      linear as never,
      EXERCISES.lookup.tests as never,
      KAFKA_POLICIES.lookup as never,
    );
    expect(r.filter((x) => !x.pass).map((x) => x.name)).toEqual([
      'reads at most 40 of 100,000 entries',
    ]);
  });
});
