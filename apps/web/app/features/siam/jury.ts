// The public jury: in the app, anonymous cases go to random people who vote and may leave a
// short opinion. Below a quorum the votes don't count; at a 90% majority against the ruling
// the judge admits error and the case is flagged for review. The demo simulates the jurors.
import { hash, rng } from '@shiqi/pixel';
import { jurorLean, type Filing, type Winner } from './court';

export const JURY_SIZE = 25;
export const QUORUM = 20;
export const OVERRULE_PCT = 90;

export interface Tally {
  votes: number;
  A: number;
  B: number;
  draw: number;
  /** Share of votes that agree with the ruling, 0–100. */
  agreePct: number;
  /** Quorum reached and at least OVERRULE_PCT disagree. */
  overruled: boolean;
}

/**
 * Simulated jurors read the case the way ordinary people do (see jurorLean), plus their own noise.
 * Deterministic for a given seed, so the same case always gets the same jury.
 */
export function simulateJury(a: Filing, b: Filing, seed: string, n = JURY_SIZE): Winner[] {
  const lean = jurorLean(a, b);
  const pDraw = 0.3 * Math.exp(-Math.abs(lean));
  const pA = 1 / (1 + Math.exp(-1.5 * lean));
  const r = rng(hash(seed));
  return Array.from({ length: n }, () => (r() < pDraw ? 'draw' : r() < pA ? 'A' : 'B'));
}

export function tally(votes: readonly Winner[], ruling: Winner): Tally {
  const count = (w: Winner) => votes.filter((v) => v === w).length;
  const agree = count(ruling);
  const agreePct = votes.length ? Math.round((agree / votes.length) * 100) : 0;
  return {
    votes: votes.length,
    A: count('A'),
    B: count('B'),
    draw: count('draw'),
    agreePct,
    overruled: votes.length >= QUORUM && 100 - agreePct >= OVERRULE_PCT,
  };
}

/** A few juror opinions to show, picked to match how they voted. */
export function opinionsFor(
  votes: readonly Winner[],
  pool: Record<Winner, readonly string[]>,
  seed: string,
  max = 3,
): { vote: Winner; text: string }[] {
  const r = rng(hash(`${seed}:opinions`));
  const seen = new Set<string>();
  const out: { vote: Winner; text: string }[] = [];
  for (const vote of votes) {
    if (out.length >= max) break;
    const options = pool[vote];
    const text = options[Math.floor(r() * options.length)];
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ vote, text });
  }
  return out;
}
