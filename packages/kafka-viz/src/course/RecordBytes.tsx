import {
  batchIsValid,
  BATCH_HEADER_BYTES,
  decodeBatch,
  encodeBatch,
  type EncodedBatch,
} from '@shiqi/kafka/storage';
import { Button, Checkbox, format, TextInput } from '@shiqi/ui';
import { useMemo, useState } from 'react';
import { useKafkaStrings } from '../strings';
import { HexView } from './HexView';
import { useStoragePolicies } from './policies';
import { RunningOn } from './RunningOn';

interface Row {
  key: string | null;
  value: string;
}

const START: Row[] = [
  { key: 'user-42', value: 'clicked buy' },
  { key: null, value: 'hello' },
];
const T0 = 1_760_000_000_000;

/** Chapter 1: type records, see the exact bytes of the batch Kafka would write, then corrupt one. */
export function RecordBytes() {
  const t = useKafkaStrings().build;
  const policies = useStoragePolicies();
  const [rows, setRows] = useState<Row[]>(START);
  const [picked, setPicked] = useState<number | null>(null);
  const [flipped, setFlipped] = useState<number | null>(null);

  const encoded = useMemo((): EncodedBatch | { error: string } => {
    try {
      return encodeBatch(
        {
          baseOffset: 0,
          records: rows.map((r, i) => ({ key: r.key, value: r.value, timestamp: T0 + i * 1500 })),
        },
        (v) => policies.writeVarint(v),
      );
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [rows, policies]);

  const update = (i: number, patch: Partial<Row>) => {
    setFlipped(null);
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  if ('error' in encoded)
    return (
      <div className="kvb-widget">
        <RunningOn policies={policies} policy="writeVarint" />
        <p className="kvb-bad">{format(t.bytes.unreadable, { error: encoded.error })}</p>
      </div>
    );

  const bytes = encoded.bytes.slice();
  if (flipped !== null && flipped < bytes.length) bytes[flipped] = (bytes[flipped] as number) ^ 1;
  const payload = rows.reduce(
    (n, r) =>
      n +
      new TextEncoder().encode(r.value).length +
      (r.key ? new TextEncoder().encode(r.key).length : 0),
    0,
  );
  const overhead = bytes.length - payload;
  const crcOk = batchIsValid(bytes, 0);
  let readBack: string;
  let readable = true;
  try {
    readBack = decodeBatch(bytes, 0)
      .records.map((r) => `${r.key ?? '∅'} → ${r.value ?? '∅'}`)
      .join(', ');
  } catch (e) {
    readable = false;
    readBack = (e as Error).message;
  }

  return (
    <div className="kvb-widget">
      <RunningOn policies={policies} policy="writeVarint" />
      <ol className="kvb-rows">
        {rows.map((r, i) => (
          <li key={i} className="kvb-row">
            <Checkbox
              label={t.bytes.nullKey}
              checked={r.key === null}
              onChange={(e) => update(i, { key: e.currentTarget.checked ? null : 'key' })}
            />
            <TextInput
              aria-label={t.bytes.key}
              placeholder={t.bytes.key}
              value={r.key ?? ''}
              disabled={r.key === null}
              onChange={(e) => update(i, { key: e.currentTarget.value })}
            />
            <TextInput
              aria-label={t.bytes.value}
              placeholder={t.bytes.value}
              value={r.value}
              onChange={(e) => update(i, { value: e.currentTarget.value })}
            />
            {rows.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFlipped(null);
                  setRows(rows.filter((_, j) => j !== i));
                }}
              >
                {t.bytes.remove}
              </Button>
            )}
          </li>
        ))}
      </ol>
      {rows.length < 4 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFlipped(null);
            setRows([...rows, { key: `user-${rows.length + 1}`, value: 'viewed page' }]);
          }}
        >
          {t.bytes.add}
        </Button>
      )}

      <HexView
        bytes={bytes}
        fields={encoded.fields}
        picked={picked}
        onPick={setPicked}
        changed={flipped === null ? undefined : new Set([flipped])}
      />

      <p className="kv-muted">
        {format(t.bytes.total, { bytes: bytes.length, n: rows.length, payload, overhead })}{' '}
        {format(t.bytes.perRecord, {
          n: Math.round((overhead - BATCH_HEADER_BYTES) / rows.length),
        })}
      </p>
      <div className="kvb-actions">
        <Button
          size="sm"
          disabled={picked === null && flipped === null}
          onClick={() => setFlipped(flipped === null ? picked : null)}
        >
          {flipped === null ? t.bytes.flip : t.bytes.unflip}
        </Button>
      </div>
      <p className={crcOk ? 'kvb-good' : 'kvb-bad'}>{crcOk ? t.bytes.crcOk : t.bytes.crcBad}</p>
      <p className={readable ? undefined : 'kvb-bad'}>
        {readable
          ? format(t.bytes.readBack, { records: readBack })
          : format(t.bytes.unreadable, { error: readBack })}
      </p>
    </div>
  );
}
