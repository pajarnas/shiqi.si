// A pocket version of the Siam court that runs in the browser for the demo on /siam.
// The real app sends both filings to an AI judge; here every judge reads the same few
// signals (evidence, detail, sweeping words, admissions, agreements) and weighs them in
// their own way, so the demo is instant, free and deterministic.
import { hash, rng } from '@shiqi/pixel';

export const JUDGE_IDS = ['tortoise', 'hare', 'cat', 'dog', 'bird', 'bear'] as const;
export type JudgeId = (typeof JUDGE_IDS)[number];

export type Side = 'A' | 'B';
export type Winner = Side | 'draw';

/** At most this many evidence items per side, as in the app. */
export const MAX_EVIDENCE = 9;

export interface Filing {
  statement: string;
  evidence: readonly string[];
}

export interface Signals {
  /** Non-empty evidence items, capped at MAX_EVIDENCE. */
  evidence: number;
  /** 0, 1 or 2: how much detail the statement gives. */
  detail: number;
  /** Sweeping words such as "always" or "never". */
  absolutes: number;
  /** Admissions such as "sorry" or "my fault". */
  admits: number;
  /** The statement points to an agreement ("we agreed", "you promised"). */
  agreement: boolean;
}

export type FindingKey =
  'evidence' | 'noEvidence' | 'detail' | 'absolutes' | 'admits' | 'agreement';

export interface Finding {
  key: FindingKey;
  side: Side;
  /** The count behind it (evidence items, sweeping words), where there is one. */
  n: number;
  /** How much this finding moved the score, for ordering. */
  weight: number;
}

export interface Verdict {
  judge: JudgeId;
  winner: Winner;
  /** Plaintiff's share of the blame, 0–100, in steps of 5. Defendant's is 100 - respA. */
  respA: number;
  findings: Finding[];
  /**
   * Set only when a snack backfired in public: the side that tried to butter up the judge,
   * which the judgment then says out loud. Accepted and hidden snacks leave no trace here.
   */
  snackStamp?: Side;
}

/**
 * Snack time. Before the first-instance ruling each side may slip the judge a snack once
 * (just a game: no money changes hands). The bear takes none. Mirrors siam-server#27.
 */
export const SNACK_JUDGES = ['tortoise', 'hare', 'cat', 'dog', 'bird'] as const;
export type SnackJudge = (typeof SNACK_JUDGES)[number];

export const SNACK_EMOJI: Record<SnackJudge, string> = {
  tortoise: '🥬',
  hare: '🥕',
  cat: '🐟',
  dog: '🦴',
  bird: '🌾',
};

export const takesSnacks = (judge: JudgeId): judge is SnackJudge =>
  (SNACK_JUDGES as readonly JudgeId[]).includes(judge);

export const SNACK_OUTCOMES = ['accepted', 'backfire_public', 'backfire_hidden'] as const;
export type SnackOutcome = (typeof SNACK_OUTCOMES)[number];

/** A snack that counts: exactly one side offered it, and this is how it landed. */
export interface Snack {
  side: Side;
  outcome: SnackOutcome;
}

/** Who offered a snack before the ruling. */
export interface SnackOffers {
  A: boolean;
  B: boolean;
}

/** How a snack lands, picked from a seed at odds 2:1:1 (accepted : public : hidden). */
export function snackOutcome(seed: string): SnackOutcome {
  const r = rng(hash(`${seed}:snack`))();
  return r < 0.5 ? 'accepted' : r < 0.75 ? 'backfire_public' : 'backfire_hidden';
}

/**
 * The snack the judge reacts to, if any. Nothing happens when the bear sits, when nobody
 * offered, or when both sides did (the snacks cancel out and nobody mentions them).
 * `pick` lets the demo visitor force an outcome; otherwise the seed decides.
 */
export function resolveSnack(
  judge: JudgeId,
  offers: SnackOffers,
  seed: string,
  pick?: SnackOutcome,
): Snack | null {
  if (!takesSnacks(judge) || offers.A === offers.B) return null;
  const side: Side = offers.A ? 'A' : 'B';
  return { side, outcome: pick ?? snackOutcome(`${seed}:${judge}:${side}`) };
}

/**
 * A snack moves the score by this much, which is 10 points of blame (respA = 50 - gap * 8).
 * It is mild on purpose: it can only change the winner when the case is close anyway.
 */
const SNACK_BLAME = 10;
const SNACK_GAP = SNACK_BLAME / 8;
/** Fair score gaps up to this (blame between about 35% and 65%) count as a close case. */
const CLOSE_GAP = 2;

export type AppealOutcome = 'upheld' | 'partial' | 'reversed';

interface Weights {
  evidence: number;
  detail: number;
  absolutes: number;
  admits: number;
  agreement: number;
  /** Score gaps inside this band end in a draw. */
  drawBand: number;
  /** How many findings the judge writes down. */
  findings: number;
}

const BASE: Weights = {
  evidence: 1,
  detail: 0.75,
  absolutes: 1,
  admits: 1.25,
  agreement: 1,
  drawBand: 0.75,
  findings: 3,
};

/** Each judge's temperament as a tweak on the same reading. */
const WEIGHTS: Record<JudgeId, Weights> = {
  tortoise: { ...BASE, detail: 1.25, findings: 4 },
  hare: { ...BASE, findings: 1, drawBand: 0.5 },
  cat: { ...BASE, evidence: 2 },
  dog: { ...BASE, admits: 0.5, drawBand: 1.75 },
  bird: { ...BASE, absolutes: 2.25 },
  bear: { ...BASE, agreement: 1.5, findings: 4 },
};

const ABSOLUTES =
  /\b(always|never|every\s+(single\s+)?time|everything|nothing|constantly)\b|每次|总是|从来|永远|一直|从不|根本/gi;
const ADMITS =
  /\b(sorry|my\s+(fault|bad)|i\s+admit|i\s+forgot|i\s+was\s+wrong)\b|对不起|抱歉|是我不对|我承认|我忘了|我错了/gi;
const AGREEMENT = /\b(agreed|promised|deal|we\s+said|rule)\b|说好|答应|约好|讲好|规定|轮流/i;

const count = (re: RegExp, text: string) => text.match(re)?.length ?? 0;

export function readFiling(f: Filing): Signals {
  const text = f.statement.trim();
  const chars = [...text].length;
  return {
    evidence: Math.min(f.evidence.filter((e) => e.trim()).length, MAX_EVIDENCE),
    detail: chars >= 120 ? 2 : chars >= 40 ? 1 : 0,
    absolutes: count(ABSOLUTES, text),
    admits: count(ADMITS, text),
    agreement: AGREEMENT.test(text),
  };
}

function findingsFor(side: Side, s: Signals, w: Weights): Finding[] {
  const out: Finding[] = [];
  const add = (key: FindingKey, n: number, weight: number) => out.push({ key, side, n, weight });
  if (s.evidence > 0) add('evidence', s.evidence, w.evidence * Math.min(s.evidence, 5) * 0.6);
  else add('noEvidence', 0, -w.evidence * 0.6);
  if (s.detail > 0) add('detail', s.detail, w.detail * s.detail);
  if (s.absolutes > 0) add('absolutes', s.absolutes, -w.absolutes * Math.min(s.absolutes, 3));
  if (s.admits > 0) add('admits', s.admits, -w.admits * Math.min(s.admits, 2));
  if (s.agreement) add('agreement', 1, w.agreement);
  return out;
}

const round5 = (n: number) => Math.round(n / 5) * 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Ordinary people on the public jury read the same signals, but forgive an honest
 * admission instead of counting it against you, which is where they part ways with the bench.
 */
const JUROR: Weights = { ...BASE, detail: 0.5, admits: -1.5 };

function weigh(judge: JudgeId | 'juror', a: Filing, b: Filing) {
  const w = judge === 'juror' ? JUROR : WEIGHTS[judge];
  const all = [...findingsFor('A', readFiling(a), w), ...findingsFor('B', readFiling(b), w)];
  const score = (side: Side) =>
    all.filter((f) => f.side === side).reduce((sum, f) => sum + f.weight, 0);
  return { w, all, gap: score('A') - score('B') };
}

/** How far a typical juror leans to the plaintiff: positive for A, negative for B. */
export function jurorLean(a: Filing, b: Filing): number {
  return weigh('juror', a, b).gap;
}

export function judgeCase(
  judge: JudgeId,
  a: Filing,
  b: Filing,
  snack: Snack | null = null,
): Verdict {
  const { w, all, gap: fair } = weigh(judge, a, b);
  // Accepted: a lean toward whoever brought the snack; a backfire: a lean against them.
  const lean = snack && takesSnacks(judge) ? (snack.outcome === 'accepted' ? 1 : -1) : 0;
  // +1 favours the plaintiff, -1 the defendant.
  const toward = lean * (snack?.side === 'B' ? -1 : 1);
  const gap = fair + toward * SNACK_GAP;
  const winnerOf = (g: number): Winner => (Math.abs(g) <= w.drawBand ? 'draw' : g > 0 ? 'A' : 'B');
  // A snack only gets a say in who wins when the fair reading is close anyway.
  const winner = Math.abs(fair) <= CLOSE_GAP ? winnerOf(gap) : winnerOf(fair);
  // The snack moves blame 10 points from the fair figure, so it shows even in a lopsided case,
  // and blame stays on the loser however the snack landed.
  const shifted = clamp(round5(50 - fair * 8), 10, 90) - toward * SNACK_BLAME;
  const respA =
    winner === 'draw' ? 50 : winner === 'A' ? clamp(shifted, 10, 45) : clamp(shifted, 55, 90);
  // Weak "no evidence" notes only matter when the other side had some.
  const findings = all
    .filter((f) => f.key !== 'noEvidence' || all.some((g) => g.key === 'evidence'))
    .sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight))
    .slice(0, w.findings);
  const verdict: Verdict = { judge, winner, respA, findings };
  if (lean && snack?.outcome === 'backfire_public') verdict.snackStamp = snack.side;
  return verdict;
}

/** The second instance must use a different judge, and only the losing side may appeal. */
export function appealJudges(first: JudgeId): JudgeId[] {
  return JUDGE_IDS.filter((j) => j !== first);
}

export function appealOutcome(first: Verdict, second: Verdict): AppealOutcome {
  if (first.winner === second.winner && Math.abs(first.respA - second.respA) < 15) return 'upheld';
  if (first.winner !== 'draw' && second.winner !== 'draw' && first.winner !== second.winner)
    return 'reversed';
  return 'partial';
}
