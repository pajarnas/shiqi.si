import { hex, type FieldSpan } from '@shiqi/kafka/storage';
import { cx, format } from '@shiqi/ui';
import { useKafkaStrings } from '../strings';

/** Colour group per field, so neighbouring fields look different. */
const GROUP: Record<FieldSpan['field'], number> = {
  baseOffset: 1,
  batchLength: 2,
  partitionLeaderEpoch: 3,
  magic: 4,
  crc: 5,
  attributes: 6,
  lastOffsetDelta: 1,
  baseTimestamp: 2,
  maxTimestamp: 3,
  producerId: 4,
  producerEpoch: 5,
  baseSequence: 6,
  recordCount: 1,
  length: 2,
  timestampDelta: 3,
  offsetDelta: 4,
  keyLength: 5,
  key: 6,
  valueLength: 5,
  value: 1,
  headerCount: 3,
};

export interface HexViewProps {
  bytes: Uint8Array;
  fields: readonly FieldSpan[];
  picked: number | null;
  onPick: (byte: number) => void;
  /** Bytes changed by hand (a flipped bit). */
  changed?: ReadonlySet<number>;
}

/** A hex dump where every byte is coloured by the field it belongs to. */
export function HexView({ bytes, fields, picked, onPick, changed }: HexViewProps) {
  const t = useKafkaStrings().build;
  const fieldAt = new Array<FieldSpan | undefined>(bytes.length);
  for (const f of fields) for (let i = f.start; i < f.end; i++) fieldAt[i] = f;
  const pickedField = picked === null ? undefined : fieldAt[picked];
  const rows: number[] = [];
  for (let r = 0; r < bytes.length; r += 16) rows.push(r);
  const [name, about] = pickedField ? t.fields[pickedField.field] : ['', ''];

  return (
    <div className="kvb-hex">
      <div className="kvb-hex__grid" role="grid" aria-label={t.hex.label}>
        {rows.map((r) => (
          <div key={r} className="kvb-hex__row" role="row">
            <span className="kvb-hex__addr" aria-hidden="true">
              {hex(r, 4)}
            </span>
            {Array.from(bytes.subarray(r, r + 16), (b, j) => {
              const i = r + j;
              const f = fieldAt[i];
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  className={cx(
                    'kvb-hex__byte',
                    f && `kvb-g${GROUP[f.field]}`,
                    f?.record === undefined && 'kvb-hex__byte--header',
                    f && f === pickedField && 'kvb-hex__byte--field',
                    i === picked && 'kvb-hex__byte--picked',
                    changed?.has(i) && 'kvb-hex__byte--changed',
                  )}
                  onClick={() => onPick(i)}
                  aria-label={f ? `${hex(b)} ${t.fields[f.field][0]}` : hex(b)}
                >
                  {hex(b)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="kvb-hex__about" aria-live="polite">
        {pickedField ? (
          <>
            <b>
              {pickedField.record === undefined
                ? t.hex.header
                : format(t.hex.record, { n: pickedField.record })}
              {' · '}
              {name}
            </b>
            <span className="kv-muted">
              {format(t.hex.offset, { start: pickedField.start, end: pickedField.end - 1 })}
              {pickedField.value !== '' &&
                ` · ${format(t.hex.value, { value: pickedField.value })}`}
            </span>
            <span>{about}</span>
          </>
        ) : (
          <span className="kv-muted">{t.hex.pick}</span>
        )}
      </div>
    </div>
  );
}
