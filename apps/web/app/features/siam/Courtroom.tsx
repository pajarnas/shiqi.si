import {
  Button,
  Callout,
  Card,
  Cluster,
  Field,
  PixelIcon,
  Select,
  Stack,
  TextArea,
  TextInput,
} from '@shiqi/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { format, useI18n } from '~/i18n';
import {
  appealJudges,
  appealOutcome,
  judgeCase,
  JUDGE_IDS,
  MAX_EVIDENCE,
  type AppealOutcome,
  type Filing,
  type JudgeId,
  type Side,
  type Verdict,
  type Winner,
} from './court';
import { antiForgeryCode, canonicalJSON, sha256Hex } from './fingerprint';
import {
  JURY_SIZE,
  opinionsFor,
  OVERRULE_PCT,
  QUORUM,
  simulateJury,
  tally,
  type Tally,
} from './jury';

/** How long each of the seven hearing stages stays on screen. */
const STAGE_MS = 600;
/** How fast simulated jurors cast their votes. */
const VOTE_MS = 90;

export interface Draft {
  title: string;
  a: string;
  aEvidence: string;
  b: string;
  bEvidence: string;
}

export const EMPTY_DRAFT: Draft = { title: '', a: '', aEvidence: '', b: '', bEvidence: '' };

const toFiling = (statement: string, evidence: string): Filing => ({
  statement,
  evidence: evidence
    .split('\n')
    .filter((e) => e.trim())
    .slice(0, MAX_EVIDENCE),
});

/** Keep the evidence box to MAX_EVIDENCE filled lines, as the app allows. */
const capEvidence = (text: string) => {
  let filled = 0;
  return text
    .split('\n')
    .filter((line) => !line.trim() || ++filled <= MAX_EVIDENCE)
    .join('\n');
};

const caseCodeOf = (hash: string) =>
  `SIAM-${hash.slice(52, 56).toUpperCase()}-${hash.slice(56, 60).toUpperCase()}`;

interface Sealed {
  verdict: Verdict;
  hash: string;
}

/** Hash exactly what the judgment says, the way the app fingerprints a ruling. */
type Instance = 1 | 2 | 'jury';

async function seal(draft: Draft, verdict: Verdict, instance: Instance): Promise<Sealed> {
  const doc = {
    court: 'Couple Court',
    instance,
    title: draft.title,
    plaintiff: toFiling(draft.a, draft.aEvidence),
    defendant: toFiling(draft.b, draft.bEvidence),
    verdict,
  };
  return { verdict, hash: await sha256Hex(canonicalJSON(doc)) };
}

export function Courtroom({
  draft,
  onDraftChange,
  makeup,
}: {
  draft: Draft;
  onDraftChange: (d: Draft) => void;
  /** The make-up plan written for the chosen scenario; own cases use a generic one. */
  makeup?: string;
}) {
  const { t } = useI18n();
  const s = t.siam;
  const [judge, setJudge] = useState<JudgeId>('cat');
  const [stage, setStage] = useState<number | null>(null);
  const [first, setFirst] = useState<Sealed | null>(null);
  const [second, setSecond] = useState<(Sealed & { outcome: AppealOutcome }) | null>(null);
  const [appealJudge, setAppealJudge] = useState<JudgeId>('bear');
  const [missing, setMissing] = useState(false);
  const [jury, setJury] = useState<JuryResult | null>(null);
  const verdictRef = useRef<HTMLDivElement>(null);

  // Any edit reopens the case.
  const edit = (patch: Partial<Draft>) => {
    onDraftChange({ ...draft, ...patch });
    setFirst(null);
    setSecond(null);
    setJury(null);
  };

  useEffect(() => {
    if (stage === null) return;
    if (stage < s.demo.stages.length - 1) {
      const id = setTimeout(() => setStage(stage + 1), STAGE_MS);
      return () => clearTimeout(id);
    }
    let live = true;
    const id = setTimeout(() => {
      const v = judgeCase(
        judge,
        toFiling(draft.a, draft.aEvidence),
        toFiling(draft.b, draft.bEvidence),
      );
      void seal(draft, v, 1).then((sealed) => {
        if (!live) return;
        setFirst(sealed);
        setStage(null);
        const next = appealJudges(judge);
        setAppealJudge(next.includes('bear') ? 'bear' : next[0]!);
      });
    }, STAGE_MS);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [stage, judge, draft, s.demo.stages.length]);

  useEffect(() => {
    if (first) verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [first, second]);

  const open = () => {
    if (!draft.a.trim() || !draft.b.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setFirst(null);
    setSecond(null);
    setJury(null);
    setStage(0);
  };

  const fileAppeal = async () => {
    if (!first) return;
    const v = judgeCase(
      appealJudge,
      toFiling(draft.a, draft.aEvidence),
      toFiling(draft.b, draft.bEvidence),
    );
    const sealed = await seal(draft, v, 2);
    setSecond({ ...sealed, outcome: appealOutcome(first.verdict, v) });
  };

  const hearing = stage !== null;
  const judgeName = (id: JudgeId) => s.judges.items[id].name;

  return (
    <Stack gap={5}>
      <Field label={s.demo.caseTitle}>
        {(p) => (
          <TextInput
            {...p}
            value={draft.title}
            placeholder={s.demo.caseTitleHint}
            onChange={(e) => edit({ title: e.target.value })}
          />
        )}
      </Field>
      <div className="siam-sides">
        {(['A', 'B'] as const).map((side) => (
          <Card key={side} padded className={`siam-side siam-side--${side}`}>
            <h3 className="siam-side__name">{side === 'A' ? s.plaintiff : s.defendant}</h3>
            <Field label={s.demo.statement}>
              {(p) => (
                <TextArea
                  {...p}
                  rows={5}
                  value={side === 'A' ? draft.a : draft.b}
                  placeholder={s.demo.statementHint}
                  onChange={(e) =>
                    edit(side === 'A' ? { a: e.target.value } : { b: e.target.value })
                  }
                />
              )}
            </Field>
            <Field label={s.demo.evidence} hint={format(s.demo.evidenceHint, { n: MAX_EVIDENCE })}>
              {(p) => (
                <TextArea
                  {...p}
                  rows={3}
                  value={side === 'A' ? draft.aEvidence : draft.bEvidence}
                  onChange={(e) =>
                    edit(
                      side === 'A'
                        ? { aEvidence: capEvidence(e.target.value) }
                        : { bEvidence: capEvidence(e.target.value) },
                    )
                  }
                />
              )}
            </Field>
          </Card>
        ))}
      </div>
      <Cluster gap={4} className="siam-bench-pick">
        <Field label={s.demo.judge}>
          {(p) => (
            <Select
              {...p}
              value={judge}
              disabled={hearing}
              onChange={(e) => {
                setJudge(e.target.value as JudgeId);
                setFirst(null);
                setSecond(null);
                setJury(null);
              }}
            >
              {JUDGE_IDS.map((id) => (
                <option key={id} value={id}>
                  {judgeName(id)} · {s.judges.items[id].role}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button variant="accent" onClick={open} disabled={hearing}>
          <PixelIcon name="gavel" size={16} /> {s.demo.start}
        </Button>
      </Cluster>
      {missing && <Callout>{s.demo.needStatements}</Callout>}
      {hearing && (
        <Card padded className="siam-hearing" aria-live="polite">
          <PixelIcon name={judge} size={48} className="siam-hearing__judge" />
          <div>
            <p className="siam-hearing__now">
              {format(s.demo.stageNow, { stage: s.demo.stages[stage] ?? '' })}
            </p>
            <ol className="siam-stages">
              {s.demo.stages.map((label, i) => (
                <li key={label} data-state={i < stage ? 'done' : i === stage ? 'now' : 'next'}>
                  {label}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}
      <div ref={verdictRef}>
        {first && (
          <Stack gap={5}>
            <Judgment
              draft={draft}
              sealed={first}
              caseCode={caseCodeOf(first.hash)}
              instance={1}
              makeup={makeup}
            />
            {!second && !jury?.ruling && (
              <Card padded className="siam-appeal">
                <h3>{s.appeal.title}</h3>
                {first.verdict.winner === 'draw' ? (
                  <p>{s.appeal.draw}</p>
                ) : (
                  <>
                    <p>{s.appeal.text}</p>
                    <Cluster gap={4}>
                      <Field label={s.appeal.judge}>
                        {(p) => (
                          <Select
                            {...p}
                            value={appealJudge}
                            onChange={(e) => setAppealJudge(e.target.value as JudgeId)}
                          >
                            {appealJudges(first.verdict.judge).map((id) => (
                              <option key={id} value={id}>
                                {judgeName(id)}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Button variant="secondary" onClick={() => void fileAppeal()}>
                        {s.appeal.button}
                      </Button>
                    </Cluster>
                  </>
                )}
              </Card>
            )}
            {second && (
              <Judgment
                draft={draft}
                sealed={second}
                caseCode={caseCodeOf(first.hash)}
                instance={2}
                makeup={makeup}
                outcome={s.appeal.outcome[second.outcome]}
              />
            )}
            <JuryPanel
              key={(second ?? first).hash}
              draft={draft}
              effective={second ?? first}
              result={jury}
              onResult={setJury}
            />
            {jury?.ruling && (
              <Judgment
                draft={draft}
                sealed={jury.ruling}
                caseCode={caseCodeOf(first.hash)}
                instance="jury"
                opinions={jury.opinions}
                outcome={format(s.jury.admits, {
                  judge: s.judges.items[jury.ruling.verdict.judge].name,
                  pct: 100 - jury.tally.agreePct,
                  n: jury.tally.votes,
                })}
              />
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setFirst(null);
                setSecond(null);
                setJury(null);
              }}
            >
              {s.demo.again}
            </Button>
          </Stack>
        )}
      </div>
    </Stack>
  );
}

function Judgment({
  draft,
  sealed: { verdict, hash },
  caseCode,
  instance,
  makeup,
  outcome,
  opinions,
}: {
  draft: Draft;
  sealed: Sealed;
  /** Both instances carry the first instance's case number. */
  caseCode: string;
  instance: Instance;
  makeup?: string;
  outcome?: string;
  /** A jury ruling rests on the jurors' words instead of the court's findings. */
  opinions?: readonly { vote: Winner; text: string }[];
}) {
  const { t } = useI18n();
  const s = t.siam;
  const v = s.verdict;
  const j = s.judges.items[verdict.judge];
  const sideName = (side: Side) => (side === 'A' ? s.plaintiff : s.defendant);
  return (
    <article className="siam-judgment" data-winner={verdict.winner}>
      <header className="siam-judgment__head">
        <span className="siam-judgment__eyebrow">
          {format(v.court, {
            instance: instance === 1 ? v.first : instance === 2 ? v.second : s.jury.instance,
          })}
        </span>
        <h3>{v.heading}</h3>
        <p className="siam-judgment__meta">
          {format(v.caseNo, { code: caseCode })}
          {draft.title.trim() && ` · ${draft.title.trim()}`}
        </p>
      </header>
      <div className="siam-judgment__judge">
        <PixelIcon name={verdict.judge} size={48} />
        <div>
          <strong>{format(v.presiding, { judge: j.name })}</strong>
          <p>“{j.catchphrase}”</p>
        </div>
      </div>
      {outcome && <p className="siam-judgment__outcome">{outcome}</p>}
      {opinions ? (
        <>
          <h4>{s.jury.opinions}</h4>
          <ul className="siam-findings">
            {opinions.map((o) => (
              <li key={o.text}>“{o.text}”</li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h4>{v.findings}</h4>
          <ol className="siam-findings">
            {verdict.findings.map((f) => (
              <li key={`${f.side}-${f.key}`}>
                {format(v.finding[f.key], { side: sideName(f.side), n: f.n })}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="siam-judgment__ruling">{v.ruling[verdict.winner]}</p>
      <h4>{v.blame}</h4>
      <div
        className="siam-blame"
        role="img"
        aria-label={`${s.plaintiff} ${verdict.respA}%, ${s.defendant} ${100 - verdict.respA}%`}
      >
        <span className="siam-blame__a" style={{ flexGrow: verdict.respA }}>
          {verdict.respA}%
        </span>
        <span className="siam-blame__b" style={{ flexGrow: 100 - verdict.respA }}>
          {100 - verdict.respA}%
        </span>
      </div>
      <p className="siam-blame__legend" aria-hidden="true">
        <span className="siam-blame__key--a">
          {format(v.blameRow, { side: s.plaintiff, pct: verdict.respA })}
        </span>
        <span className="siam-blame__key--b">
          {format(v.blameRow, { side: s.defendant, pct: 100 - verdict.respA })}
        </span>
      </p>
      <h4>{v.makeup}</h4>
      <p>{makeup ?? v.makeupOwn}</p>
      <footer className="siam-judgment__foot">
        <div>
          <span className="siam-judgment__label">{v.code}</span>
          <code className="siam-judgment__code">{antiForgeryCode(hash)}</code>
          <span className="siam-judgment__label">{v.hash}</span>
          <code className="siam-judgment__hash">{hash}</code>
          <p className="siam-judgment__note">{v.hashNote}</p>
        </div>
        <span className="siam-seal" aria-hidden="true">
          {v.seal}
        </span>
      </footer>
    </article>
  );
}

interface JuryResult {
  votes: Winner[];
  tally: Tally;
  opinions: { vote: Winner; text: string }[];
  /** The reversed ruling, when the jury overrules the court. */
  ruling?: Sealed;
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/** The jury's ruling: its majority wins, and blame follows the vote shares. */
function juryVerdict(effective: Verdict, t: Tally): Verdict {
  const ranked = (['A', 'B', 'draw'] as const).toSorted((x, y) => t[y] - t[x]);
  const top = ranked[0]!;
  const winner: Winner = t[top] === t[ranked[1]!] ? 'draw' : top;
  const respA =
    winner === 'draw'
      ? 50
      : Math.min(90, Math.max(10, round5(((t.B + t.draw / 2) / t.votes) * 100)));
  return { ...effective, winner, respA };
}

function JuryPanel({
  draft,
  effective,
  result,
  onResult,
}: {
  draft: Draft;
  effective: Sealed;
  result: JuryResult | null;
  onResult: (r: JuryResult) => void;
}) {
  const { t } = useI18n();
  const s = t.siam;
  const [cast, setCast] = useState<Winner[] | null>(null);
  const all = useMemo(
    () =>
      simulateJury(
        toFiling(draft.a, draft.aEvidence),
        toFiling(draft.b, draft.bEvidence),
        effective.hash,
      ),
    [draft, effective.hash],
  );

  useEffect(() => {
    if (!cast || result) return;
    if (cast.length < all.length) {
      const id = setTimeout(() => setCast(all.slice(0, cast.length + 1)), VOTE_MS);
      return () => clearTimeout(id);
    }
    let live = true;
    const tl = tally(all, effective.verdict.winner);
    const opinions = opinionsFor(all, s.jury.pool, effective.hash);
    if (!tl.overruled) onResult({ votes: all, tally: tl, opinions });
    else
      void seal(draft, juryVerdict(effective.verdict, tl), 'jury').then(
        (ruling) => live && onResult({ votes: all, tally: tl, opinions, ruling }),
      );
    return () => {
      live = false;
    };
  }, [cast, all, result, effective, draft, onResult, s.jury.pool]);

  const shown = result?.votes ?? cast ?? [];
  const live = tally(shown, effective.verdict.winner);
  const side = (w: Winner) => (w === 'A' ? s.plaintiff : w === 'B' ? s.defendant : s.jury.draw);

  return (
    <Card padded className="siam-jury">
      <h3>{s.jury.title}</h3>
      <p>{format(s.jury.text, { quorum: QUORUM, pct: OVERRULE_PCT })}</p>
      {!cast && !result ? (
        <Button variant="secondary" onClick={() => setCast([])}>
          <PixelIcon name="face" size={16} /> {s.jury.button}
        </Button>
      ) : (
        <Stack gap={3}>
          <div className="siam-jury__seats" aria-hidden="true">
            {all.map((_, i) => (
              <span key={i} data-vote={shown[i] ?? 'none'} />
            ))}
          </div>
          <p className="siam-jury__count" aria-live="polite">
            {result
              ? format(s.jury.agree, { pct: result.tally.agreePct, n: result.tally.votes })
              : format(s.jury.counting, { n: shown.length, total: JURY_SIZE })}
          </p>
          <p className="siam-jury__legend">
            {(['A', 'B', 'draw'] as const).map((w) => (
              <span key={w} data-vote={w}>
                {side(w)} {live[w]}
              </span>
            ))}
          </p>
          {result && !result.ruling && <p className="siam-jury__verdict">{s.jury.upheld}</p>}
          {result?.ruling && <Callout>{s.jury.superseded}</Callout>}
          {result && result.opinions.length > 0 && (
            <div>
              <h4>{s.jury.opinions}</h4>
              <ul className="siam-jury__opinions">
                {result.opinions.map((o) => (
                  <li key={o.text} data-vote={o.vote}>
                    “{o.text}” <span>· {side(o.vote)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="siam-jury__note">{format(s.jury.simulated, { n: JURY_SIZE })}</p>
        </Stack>
      )}
    </Card>
  );
}
