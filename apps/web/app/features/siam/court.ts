// A pocket version of the Siam court that runs in the browser for the demo on /siam.
// The real app sends both filings to an AI judge; here every judge reads the same few
// signals (evidence, detail, sweeping words, admissions, agreements) and weighs them in
// their own way, so the demo is instant, free and deterministic.

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
}

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

export function judgeCase(judge: JudgeId, a: Filing, b: Filing): Verdict {
  const { w, all, gap } = weigh(judge, a, b);
  const winner: Winner = Math.abs(gap) <= w.drawBand ? 'draw' : gap > 0 ? 'A' : 'B';
  const respA = winner === 'draw' ? 50 : clamp(round5(50 - gap * 8), 10, 90);
  // Weak "no evidence" notes only matter when the other side had some.
  const findings = all
    .filter((f) => f.key !== 'noEvidence' || all.some((g) => g.key === 'evidence'))
    .sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight))
    .slice(0, w.findings);
  return { judge, winner, respA, findings };
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
