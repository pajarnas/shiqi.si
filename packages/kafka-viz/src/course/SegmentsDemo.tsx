import { segmentFileName } from '@shiqi/kafka';
import { OffsetOutOfRange, PartitionLog, type LogSegment } from '@shiqi/kafka/storage';
import { Button, Checkbox, cx, format, Select, useInterval } from '@shiqi/ui';
import { useReducer, useState } from 'react';
import { useKafkaStrings } from '../strings';
import { useStoragePolicies } from './policies';
import { RunningOn } from './RunningOn';

const MIN = 60_000;
const HOUR = 60 * MIN;
const SEGMENT_BYTES = [512, 1024, 2048] as const;
const RETENTION_MS = [-1, HOUR, 2 * HOUR, 6 * HOUR] as const;
const RETENTION_BYTES = [-1, 2048, 4096] as const;

interface Gone {
  name: string;
  from: number;
  to: number;
}

const clock = (ms: number) => {
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const age = (ms: number) =>
  ms >= HOUR ? `${(ms / HOUR).toFixed(1)} h` : `${Math.round(ms / MIN)} min`;

/** Chapter 3: segments roll, retention deletes whole old segments, a slow consumer falls off the end. */
export function SegmentsDemo() {
  const t = useKafkaStrings().build;
  const policies = useStoragePolicies();
  const [l] = useState(() => new PartitionLog({ segmentBytes: 1024 }));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [now, setNow] = useState(0);
  const [auto, setAuto] = useState(false);
  const [gone, setGone] = useState<Gone[]>([]);
  const [consumer, setConsumer] = useState(0);
  const [read, setRead] = useState<{ value: string } | { error: OffsetOutOfRange } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retain = (at: number) => {
    try {
      const deleted = l.deleteOldSegments(at, policies);
      if (deleted.length) {
        const next = l.segments[0] as LogSegment;
        setGone((g) =>
          [
            ...deleted.map((s, i) => ({
              name: segmentFileName(s.baseOffset),
              from: s.baseOffset,
              to: (deleted[i + 1]?.baseOffset ?? next.baseOffset) - 1,
            })),
            ...g,
          ].slice(0, 4),
        );
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const produce = () => {
    for (let i = 0; i < 10; i++)
      l.append(
        [
          {
            key: `order-${(l.logEndOffset * 7) % 31}`,
            value: `order #${l.logEndOffset}`,
            timestamp: now + i * MIN,
          },
        ],
        0,
        policies,
      );
    const at = now + 10 * MIN;
    setNow(at);
    retain(at);
    bump();
  };

  const advance = () => {
    const at = now + HOUR;
    setNow(at);
    retain(at);
    bump();
  };

  useInterval(produce, auto ? 900 : null);

  const configure = (patch: Partial<PartitionLog['config']>) => {
    Object.assign(l.config, patch);
    retain(now);
    bump();
  };

  const readNext = () => {
    try {
      const rec = l.read(consumer, policies)[0];
      setRead({ value: `${rec?.key ?? '∅'} → ${rec?.value ?? '∅'}` });
      setConsumer(consumer + 1);
    } catch (e) {
      if (e instanceof OffsetOutOfRange) setRead({ error: e });
      else throw e;
    }
  };

  const label = (ms: number) =>
    ms < 0 ? t.segments.forever : format(t.segments.hours, { n: ms / HOUR });
  const bytesLabel = (b: number) => (b < 0 ? t.segments.unlimited : `${b} B`);

  return (
    <div className="kvb-widget">
      <RunningOn policies={policies} policy="segmentsToDelete" />
      <div className="kvb-controls">
        <label className="kvb-field">
          <span>{t.segments.segmentBytes}</span>
          <Select
            value={l.config.segmentBytes}
            onChange={(e) => configure({ segmentBytes: Number(e.currentTarget.value) })}
          >
            {SEGMENT_BYTES.map((b) => (
              <option key={b} value={b}>
                {b} B
              </option>
            ))}
          </Select>
        </label>
        <label className="kvb-field">
          <span>{t.segments.retentionMs}</span>
          <Select
            value={l.config.retentionMs}
            onChange={(e) => configure({ retentionMs: Number(e.currentTarget.value) })}
          >
            {RETENTION_MS.map((ms) => (
              <option key={ms} value={ms}>
                {label(ms)}
              </option>
            ))}
          </Select>
        </label>
        <label className="kvb-field">
          <span>{t.segments.retentionBytes}</span>
          <Select
            value={l.config.retentionBytes}
            onChange={(e) => configure({ retentionBytes: Number(e.currentTarget.value) })}
          >
            {RETENTION_BYTES.map((b) => (
              <option key={b} value={b}>
                {bytesLabel(b)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="kvb-actions">
        <Button size="sm" onClick={produce}>
          {t.segments.produce}
        </Button>
        <Button size="sm" variant="ghost" onClick={advance}>
          {t.segments.hour}
        </Button>
        <Checkbox
          label={t.segments.auto}
          checked={auto}
          onChange={(e) => setAuto(e.currentTarget.checked)}
        />
        <span className="kv-muted">{format(t.segments.clock, { time: clock(now) })}</span>
      </div>
      {error && <p className="kvb-bad">{format(t.segments.threw, { error })}</p>}

      <p className="kvb-file">{t.segments.dir}</p>
      <ul className="kvb-dir">
        {l.segments.map((s, i) => {
          const active = i === l.segments.length - 1;
          const end = active
            ? l.logEndOffset - 1
            : (l.segments[i + 1] as LogSegment).baseOffset - 1;
          return (
            <li key={s.baseOffset} className={cx('kvb-dir__seg', active && 'kvb-dir__seg--active')}>
              <span
                className="kvb-dir__fill"
                style={{ width: `${Math.min(100, (s.size / l.config.segmentBytes) * 100)}%` }}
                aria-hidden="true"
              />
              <code>{segmentFileName(s.baseOffset)}</code>
              <span>{format(t.segments.size, { bytes: s.size })}</span>
              <span>
                {end >= s.baseOffset
                  ? format(t.segments.range, { from: s.baseOffset, to: end })
                  : ''}
              </span>
              <span className="kv-muted">
                {s.largestTimestamp >= 0
                  ? format(t.segments.newest, { age: age(now - s.largestTimestamp) })
                  : ''}
              </span>
              {active && <b>{t.segments.active}</b>}
            </li>
          );
        })}
        {gone.map((g) => (
          <li key={g.name} className="kvb-dir__seg kvb-dir__seg--gone">
            <code>{g.name}</code>
            <span>{format(t.segments.range, { from: g.from, to: g.to })}</span>
            <b>{t.segments.deleted}</b>
          </li>
        ))}
      </ul>
      <p className="kv-muted">
        {format(t.segments.summary, { start: l.logStartOffset, end: l.logEndOffset, size: l.size })}
      </p>

      <p>{format(t.segments.consumer, { offset: consumer })}</p>
      <div className="kvb-actions">
        <Button size="sm" disabled={consumer >= l.logEndOffset} onClick={readNext}>
          {t.segments.read}
        </Button>
        {read && 'error' in read && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setConsumer(l.logStartOffset);
              setRead(null);
            }}
          >
            {t.segments.jump}
          </Button>
        )}
      </div>
      {read && 'value' in read && <p className="kv-muted">{read.value}</p>}
      {read && 'error' in read && (
        <p className="kvb-bad">
          {format(t.segments.outOfRange, {
            offset: read.error.offset,
            start: read.error.logStartOffset,
          })}
        </p>
      )}
    </div>
  );
}
