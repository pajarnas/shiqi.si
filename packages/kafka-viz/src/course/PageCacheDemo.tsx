import {
  decodeBatch,
  KAFKA_POLICIES,
  PartitionLog,
  recoverHelpers,
  seededRandom,
  type LogSegment,
  type RecoveryReport,
} from '@shiqi/kafka/storage';
import { Button, Checkbox, format, Select, useInterval } from '@shiqi/ui';
import { useReducer, useRef, useState } from 'react';
import { useKafkaStrings } from '../strings';
import { useStoragePolicies } from './policies';
import { RunningOn } from './RunningOn';

const PAGE = 64;
const ROW = 1024;
const FLUSH_EVERY = [0, 1, 5] as const;

type Outcome =
  | { kind: 'lost' }
  | { kind: 'recovered'; reports: RecoveryReport[]; before: number; after: number }
  | { kind: 'broken'; position: number; error: string }
  | { kind: 'threw'; error: string };

/** The first batch position at which the file stops being readable, or null. */
function firstBroken(s: LogSegment): { position: number; error: string } | null {
  let pos = 0;
  while (pos < s.size) {
    try {
      const b = decodeBatch(s.data, pos);
      if (!b.crcOk) return { position: pos, error: 'CRC mismatch' };
      pos += 12 + b.length;
    } catch (e) {
      return { position: pos, error: (e as Error).message };
    }
  }
  return null;
}

/** One segment as byte rows: on disk vs only in memory, pages, batches, torn tail. */
function ByteStrip({ seg, torn }: { seg: LogSegment; torn: number | null }) {
  const rows: number[] = [];
  for (let r = 0; r < Math.max(seg.size, 1); r += ROW) rows.push(r);
  const batches = seg.batchPositions();
  return (
    <div className="kvb-strip">
      {rows.map((r) => {
        const end = Math.min(r + ROW, seg.size);
        const clip = (a: number, b: number) => [Math.max(a, r), Math.min(b, end)] as const;
        const [d0, d1] = clip(0, seg.durable);
        const [m0, m1] = clip(seg.durable, seg.size);
        const [t0, t1] = torn === null ? [0, 0] : clip(torn, seg.size);
        const ticks: number[] = [];
        for (let p = Math.ceil(r / PAGE) * PAGE; p <= end; p += PAGE) ticks.push(p);
        return (
          <svg
            key={r}
            className="kvb-strip__row"
            viewBox={`${r} 0 ${ROW} 10`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect x={r} y={0} width={ROW} height={10} className="kvb-strip__empty" />
            {d1 > d0 && (
              <rect x={d0} y={0} width={d1 - d0} height={10} className="kvb-strip__disk" />
            )}
            {m1 > m0 && (
              <rect x={m0} y={0} width={m1 - m0} height={10} className="kvb-strip__mem" />
            )}
            {t1 > t0 && (
              <rect x={t0} y={0} width={t1 - t0} height={10} className="kvb-strip__torn" />
            )}
            {ticks.map((p) => (
              <line key={p} x1={p} x2={p} y1={7} y2={10} className="kvb-strip__page" />
            ))}
            {batches
              .filter((p) => p >= r && p < end)
              .map((p) => (
                <line key={`b${p}`} x1={p} x2={p} y1={0} y2={10} className="kvb-strip__batch" />
              ))}
          </svg>
        );
      })}
    </div>
  );
}

/** Chapter 4: writes land in the page cache; a power cut tears the file; recovery cuts it back. */
export function PageCacheDemo() {
  const t = useKafkaStrings().build;
  const policies = useStoragePolicies();
  const [l] = useState(() => new PartitionLog({ segmentBytes: 1 << 20, pageBytes: PAGE }));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [auto, setAuto] = useState(false);
  const [flushEvery, setFlushEvery] = useState<number>(0);
  const [sinceFlush, setSinceFlush] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const cuts = useRef(0);
  const seg = l.active;

  const produce = () => {
    if (l.unclean) return;
    const n = 1 + (l.logEndOffset % 3);
    l.append(
      Array.from({ length: n }, (_, i) => ({
        key: `sensor-${(l.logEndOffset + i) % 4}`,
        value: `reading ${l.logEndOffset + i}`,
        timestamp: l.logEndOffset + i,
      })),
      0,
      policies,
    );
    const since = sinceFlush + 1;
    if (flushEvery > 0 && since >= flushEvery) {
      l.flush();
      setSinceFlush(0);
    } else setSinceFlush(since);
    setOutcome(null);
    bump();
  };

  useInterval(produce, auto && !l.unclean ? 700 : null);

  const cut = () => {
    setAuto(false);
    l.powerLoss(seededRandom(++cuts.current * 7919 + l.logEndOffset));
    setOutcome({ kind: 'lost' });
    bump();
  };

  const restart = () => {
    const before = l.logEndOffset;
    try {
      const reports = l.recover(policies);
      const broken = firstBroken(l.active);
      setOutcome(
        broken
          ? { kind: 'broken', ...broken }
          : { kind: 'recovered', reports, before, after: l.logEndOffset },
      );
    } catch (e) {
      // Like a broker whose recovery crashes: it stays down until the code is fixed.
      setOutcome({ kind: 'threw', error: (e as Error).message });
    }
    setSinceFlush(0);
    bump();
  };

  const torn = l.unclean ? KAFKA_POLICIES.recover(seg.data, recoverHelpers(seg.data)) : null;

  return (
    <div className="kvb-widget">
      <RunningOn policies={policies} policy="recover" />
      <div className="kvb-controls">
        <label className="kvb-field">
          <span>{t.cache.flushEvery}</span>
          <Select value={flushEvery} onChange={(e) => setFlushEvery(Number(e.currentTarget.value))}>
            {FLUSH_EVERY.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t.cache.never : format(t.cache.batches, { n })}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="kvb-actions">
        <Button size="sm" disabled={l.unclean} onClick={produce}>
          {t.cache.produce}
        </Button>
        <Checkbox
          label={t.cache.auto}
          checked={auto}
          disabled={l.unclean}
          onChange={(e) => setAuto(e.currentTarget.checked)}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={l.unclean}
          onClick={() => {
            l.flush();
            setSinceFlush(0);
            bump();
          }}
        >
          {t.cache.flush}
        </Button>
        {l.unclean ? (
          <Button size="sm" onClick={restart}>
            {t.cache.restart}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={!seg.dirty} onClick={cut}>
            {t.cache.power}
          </Button>
        )}
      </div>

      <p className="kvb-file">
        <code>00000000000000000000.log</code>{' '}
        {format(t.cache.dirty, { dirty: seg.dirty, size: seg.size })}
      </p>
      <ByteStrip seg={seg} torn={torn !== null && torn < seg.size ? torn : null} />
      <p className="kv-muted">{t.cache.legend}</p>

      {outcome?.kind === 'lost' && (
        <p className="kvb-bad">
          {t.cache.lost} {t.cache.needsRecovery}
        </p>
      )}
      {outcome?.kind === 'recovered' && (
        <p className="kvb-good">
          {outcome.reports.length
            ? format(t.cache.recovered, {
                bytes: outcome.reports.reduce((n, r) => n + r.truncatedBytes, 0),
                before: outcome.before,
                after: outcome.after,
              })
            : format(t.cache.clean, { after: outcome.after })}
        </p>
      )}
      {outcome?.kind === 'broken' && (
        <p className="kvb-bad">
          {format(t.cache.brokenAfter, { position: outcome.position, error: outcome.error })}
        </p>
      )}
      {outcome?.kind === 'threw' && (
        <p className="kvb-bad">{format(t.cache.threw, { error: outcome.error })}</p>
      )}
    </div>
  );
}
