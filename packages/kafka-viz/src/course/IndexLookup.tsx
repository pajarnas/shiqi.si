import { PartitionLog, type IndexEntry, type ReadResult } from '@shiqi/kafka/storage';
import { cx, format, Range, Segmented, TextInput } from '@shiqi/ui';
import { useMemo, useState } from 'react';
import { useKafkaStrings } from '../strings';
import { countingArray } from './exercises';
import { useStoragePolicies } from './policies';
import { RunningOn } from './RunningOn';

const RECORDS = 300;
const INTERVALS = ['0', '256', '1024', '4096', 'none'] as const;
type Interval = (typeof INTERVALS)[number];

function buildLog(interval: Interval) {
  const log = new PartitionLog({
    segmentBytes: 1 << 20,
    indexIntervalBytes: interval === 'none' ? Infinity : Number(interval),
  });
  for (let i = 0; i < RECORDS; i++)
    log.append([{ key: `user-${(i * 7) % 23}`, value: `event ${i}`, timestamp: i * 1000 }]);
  return log;
}

interface Search {
  result?: ReadResult;
  probed: number[];
  error?: string;
  wrong?: number;
}

/** Chapter 2: find an offset with the sparse index, then scan. Shows what was read. */
export function IndexLookup() {
  const t = useKafkaStrings().build;
  const policies = useStoragePolicies();
  const [interval, setInterval] = useState<Interval>('1024');
  const [target, setTarget] = useState(217);
  const log = useMemo(() => buildLog(interval), [interval]);
  const seg = log.active;
  const positions = useMemo(() => seg.batchPositions(), [seg]);

  const search = useMemo((): Search => {
    const probed: number[] = [];
    // Count which index entries the lookup reads, whoever wrote it.
    const counting = {
      ...policies,
      lookup: (index: readonly IndexEntry[], tgt: number) => {
        const c = countingArray(index as IndexEntry[]);
        try {
          return policies.lookup(c.array, tgt);
        } finally {
          probed.push(...c.probed);
        }
      },
    };
    try {
      const result = log.locate(target, counting);
      const wrong = result.entry && result.entry.offset > target ? result.entry.offset : undefined;
      return { result, probed, wrong };
    } catch (e) {
      return { probed, error: (e as Error).message };
    }
  }, [log, policies, target]);

  const { result } = search;
  const scanned = new Set(result?.scanned ?? []);
  const probed = new Set(search.probed);
  const options = INTERVALS.map((v) => ({
    value: v,
    label: v === '0' ? t.index.every : v === 'none' ? t.index.none : v,
  }));

  return (
    <div className="kvb-widget">
      <RunningOn policies={policies} policy="lookup" />
      <Segmented
        label={t.index.interval}
        options={options}
        value={interval}
        onChange={setInterval}
      />
      <label className="kvb-field">
        <span>{t.index.target}</span>
        <Range
          min={0}
          max={RECORDS - 1}
          value={target}
          onChange={(e) => setTarget(Number(e.currentTarget.value))}
        />
        <TextInput
          type="number"
          min={0}
          max={RECORDS - 1}
          value={target}
          onChange={(e) =>
            setTarget(Math.max(0, Math.min(RECORDS - 1, Number(e.currentTarget.value) || 0)))
          }
          className="kvb-num"
        />
      </label>

      <p className="kvb-file">
        <code>00000000000000000000.index</code>{' '}
        {format(t.index.file, { entries: seg.index.length, bytes: seg.index.length * 8 })}
      </p>
      <div className="kvb-cells kvb-cells--index">
        {seg.index.map((e, i) => (
          <span
            key={i}
            className={cx(
              'kvb-cell',
              probed.has(i) && 'kvb-cell--probed',
              result?.entry === e && 'kvb-cell--hit',
            )}
            title={`${e.offset} → ${e.position}`}
          />
        ))}
      </div>

      <p className="kvb-file">
        <code>00000000000000000000.log</code>{' '}
        {format(t.index.log, { batches: positions.length, bytes: seg.size })}
      </p>
      <div className="kvb-cells kvb-cells--log">
        {positions.map((p, i) => (
          <span
            key={p}
            className={cx(
              'kvb-cell',
              scanned.has(p) && 'kvb-cell--scanned',
              result?.position === p && 'kvb-cell--hit',
            )}
            title={`#${i} @${p}`}
          />
        ))}
      </div>

      <ul className="kvb-stats">
        {search.error && (
          <li className="kvb-bad">{format(t.index.threw, { error: search.error })}</li>
        )}
        {result && (
          <>
            <li>
              {result.entry
                ? format(t.index.started, {
                    position: result.entry.position,
                    offset: result.entry.offset,
                  })
                : format(t.index.noEntry, { offset: target })}
            </li>
            <li>{format(t.index.probed, { n: search.probed.length })}</li>
            <li>
              {format(t.index.scanned, {
                n: result.scanned.length,
                bytes: result.bytesScanned,
              })}
            </li>
            {search.wrong !== undefined ? (
              <li className="kvb-bad">{format(t.index.wrong, { got: search.wrong, target })}</li>
            ) : (
              <li className="kvb-good">
                {format(t.index.found, { offset: target, position: result.position })}
              </li>
            )}
          </>
        )}
      </ul>
    </div>
  );
}
