import { Button, cx, format, Segmented } from '@shiqi/ui';
import { useState } from 'react';
import { useKafkaStrings } from '../strings';

type Mode = 'queue' | 'log';
const READERS = ['A', 'B'] as const;
type Reader = (typeof READERS)[number];

/** Chapter 0: the same messages in a queue and in a log, read by two readers. */
export function QueueVsLog() {
  const t = useKafkaStrings().build.queue;
  const [mode, setMode] = useState<Mode>('queue');
  const [sent, setSent] = useState(3);
  /** Queue: messages still in it. */
  const [queue, setQueue] = useState<number[]>([0, 1, 2]);
  /** Log: each reader's offset. */
  const [offsets, setOffsets] = useState<Record<Reader, number>>({ A: 0, B: 0 });
  const [last, setLast] = useState<Partial<Record<Reader, string>>>({});

  const msg = (n: number) => `m${n}`;
  const send = () => {
    setQueue([...queue, sent]);
    setSent(sent + 1);
  };
  const take = (r: Reader) => {
    if (mode === 'queue') {
      const [head, ...rest] = queue;
      setQueue(rest);
      setLast({
        ...last,
        [r]: head === undefined ? t.empty : format(t.got, { name: r, message: msg(head) }),
      });
    } else {
      const o = offsets[r];
      if (o >= sent) return setLast({ ...last, [r]: t.empty });
      setOffsets({ ...offsets, [r]: o + 1 });
      setLast({ ...last, [r]: format(t.got, { name: r, message: msg(o) }) });
    }
  };

  const cells = Array.from({ length: sent }, (_, i) => i);
  return (
    <div className="kvb-widget">
      <Segmented
        label={t.mode}
        options={[
          { value: 'queue', label: t.queue },
          { value: 'log', label: t.log },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setLast({});
        }}
      />
      <p className="kv-muted">{mode === 'queue' ? t.queueNote : t.logNote}</p>
      <div className="kvb-cells kvb-cells--queue" aria-live="polite">
        {cells.map((i) => {
          const present = mode === 'log' || queue.includes(i);
          return (
            <span key={i} className={cx('kvb-msg', !present && 'kvb-msg--gone')}>
              {msg(i)}
              {mode === 'log' &&
                READERS.filter((r) => offsets[r] === i).map((r) => (
                  <b key={r} className="kvb-msg__reader">
                    {r}
                  </b>
                ))}
            </span>
          );
        })}
        {mode === 'log' && READERS.some((r) => offsets[r] === sent) && (
          <span className="kvb-msg kvb-msg--end">
            {READERS.filter((r) => offsets[r] === sent).map((r) => (
              <b key={r} className="kvb-msg__reader">
                {r}
              </b>
            ))}
          </span>
        )}
      </div>
      <div className="kvb-actions">
        <Button size="sm" onClick={send}>
          {t.send}
        </Button>
        {READERS.map((r) => (
          <Button key={r} size="sm" variant="ghost" onClick={() => take(r)}>
            {format(t.take, { name: r })}
          </Button>
        ))}
        {mode === 'log' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOffsets({ ...offsets, B: 0 });
              setLast({ ...last, B: undefined });
            }}
          >
            {format(t.rewind, { name: 'B' })}
          </Button>
        )}
      </div>
      <ul className="kvb-stats">
        {READERS.map((r) => (
          <li key={r}>
            {mode === 'log' && `${format(t.at, { name: r, offset: offsets[r] })} · `}
            {last[r] ?? ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
