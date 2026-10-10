import type { KRecord, ReplicaLog } from '@shiqi/kafka';
import { cx } from '@shiqi/ui';
import type { CSSProperties } from 'react';
import { keyColor } from '../keys';

export interface LogStripProps {
  log: ReplicaLog;
  /** First offset drawn (inclusive). */
  from: number;
  /** Last offset drawn (exclusive); usually the leader's log end offset. */
  to: number;
  highWatermark: number;
  /** Extra markers under the strip, e.g. committed offsets. */
  pins?: { offset: number; label: string }[];
  size?: 'sm' | 'lg';
  showOffsets?: boolean;
}

/**
 * A run of offsets as pixel cells. Filled cells are records this replica has
 * (coloured by key); hollow ones are offsets it doesn't have yet (or that
 * compaction removed). A gold bar marks the high watermark.
 */
export function LogStrip({
  log,
  from,
  to,
  highWatermark,
  pins = [],
  size = 'sm',
  showOffsets,
}: LogStripProps) {
  const records = new Map<number, KRecord>();
  for (const r of log.read(Math.max(from, log.logStartOffset), to)) records.set(r.offset, r);
  const cells: number[] = [];
  for (let o = from; o < to; o++) cells.push(o);
  return (
    <span
      className={cx('kv-strip', `kv-strip--${size}`)}
      style={{ '--cells': cells.length } as CSSProperties}
    >
      {cells.map((o) => {
        const r = records.get(o);
        const missing = o >= log.logEndOffset;
        const gone = o < log.logStartOffset || (!r && !missing);
        return (
          <span
            key={o}
            className={cx(
              'kv-cell',
              missing && 'kv-cell--missing',
              gone && 'kv-cell--gone',
              r?.value === null && 'kv-cell--tombstone',
              o >= highWatermark && !missing && 'kv-cell--uncommitted',
            )}
            style={r ? ({ '--cell': keyColor(r.key) } as CSSProperties) : undefined}
            title={r ? `#${o} ${r.key ?? '∅'} → ${r.value ?? '∅'}` : `#${o}`}
          >
            {showOffsets && <span className="kv-cell__offset">{o}</span>}
          </span>
        );
      })}
      {highWatermark > from && highWatermark <= to && (
        <span className="kv-strip__hw" style={{ '--at': highWatermark - from } as CSSProperties} />
      )}
      {pins
        .filter((p) => p.offset >= from && p.offset <= to)
        .map((p) => (
          <span
            key={p.label}
            className="kv-strip__pin"
            style={{ '--at': p.offset - from } as CSSProperties}
            title={p.label}
          />
        ))}
    </span>
  );
}
