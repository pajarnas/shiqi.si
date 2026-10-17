import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JUDGE_IDS } from './court';

const seals = fileURLToPath(new URL('../../../public/siam/seals/', import.meta.url));

describe('judge seals', () => {
  it('has a red-ink and a colour seal for every judge', () => {
    for (const id of JUDGE_IDS) {
      for (const ink of ['', '-color']) {
        expect(existsSync(`${seals}seal-${id}${ink}.svg`), `seal-${id}${ink}.svg`).toBe(true);
      }
    }
  });
});
