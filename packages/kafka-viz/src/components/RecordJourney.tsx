import { murmur2, toPositive, type Cluster, type Partition } from '@shiqi/kafka';
import { Button, cx } from '@shiqi/ui';
import type { CSSProperties } from 'react';
import { preciseClock as clock } from '../format';
import { keyColor } from '../keys';
import { format, useKafkaStrings } from '../strings';

interface Line {
  at: number;
  text: string;
  tone?: 'good' | 'bad';
}

/**
 * Everything that happened to one record: how its partition was chosen, which
 * replicas copied it and whether that copy is on disk yet, when it became
 * committed, when the producer heard back, and who read it.
 */
export function RecordJourney({
  cluster,
  partition: p,
  broker,
  offset,
  onClose,
}: {
  cluster: Cluster;
  partition: Partition;
  broker: number;
  offset: number;
  onClose: () => void;
}) {
  const t = useKafkaStrings();
  const j = t.journey;
  const record = p.logs.get(broker)?.read(offset, offset + 1)[0];
  if (!record) return null;
  const trace = cluster.trace(record);
  const title = format(j.title, { offset, topic: p.topic, partition: p.id });

  const lines: Line[] = [];
  if (trace) {
    lines.push({
      at: trace.producedAt,
      text: format(j.produced, {
        producer: record.producer,
        broker: trace.leader,
        time: clock(trace.producedAt),
        epoch: record.leaderEpoch,
      }),
    });
    for (const [b, at] of trace.copies)
      lines.push({
        at,
        text: `${format(j.copy, { broker: b })}: ${format(j.copied, { time: clock(at) })}`,
      });
    if (trace.committedAt !== undefined)
      lines.push({
        at: trace.committedAt,
        text: format(j.committed, { time: clock(trace.committedAt) }),
        tone: 'good',
      });
    if (trace.ackedAt !== undefined)
      lines.push({
        at: trace.ackedAt,
        text: trace.ackError
          ? format(j.ackFailed, { error: trace.ackError })
          : format(j.acked, { time: clock(trace.ackedAt), acks: String(trace.acks) }),
        tone: trace.ackError ? 'bad' : 'good',
      });
    for (const [group, c] of trace.consumed)
      lines.push({ at: c.at, text: format(j.consumed, { group, time: clock(c.at) }) });
    if (trace.goneAt !== undefined)
      lines.push({
        at: trace.goneAt,
        text: format(j.gone, { time: clock(trace.goneAt) }),
        tone: 'bad',
      });
    lines.sort((a, b) => a.at - b.at);
  }

  const pending: string[] = [];
  if (trace && trace.committedAt === undefined) pending.push(j.notCommitted);
  if (trace && trace.ackedAt === undefined && trace.acks === 'all') pending.push(j.waiting);
  const groups = [...cluster.groups.values()].filter(
    (g) =>
      [...g.members.values()].some((m) => m.topics.includes(p.topic)) ||
      g.committed.has(`${p.topic}-${p.id}`),
  );
  for (const g of groups) {
    const read = trace?.consumed.has(g.id);
    const past = (g.committed.get(`${p.topic}-${p.id}`) ?? -1) > offset;
    if (!read) pending.push(format(past ? j.skipped : j.notConsumed, { group: g.id }));
    else if (past) pending.push(format(j.committedBy, { group: g.id }));
  }
  if (trace && trace.deliveries > trace.consumed.size)
    pending.push(format(j.twice, { n: trace.deliveries }));

  const hash = record.key === null ? null : murmur2(record.key);
  const positive = hash === null ? null : toPositive(hash);
  const n = trace?.partitions ?? cluster.topic(p.topic).partitions.length;

  return (
    <section className="kv-journey" aria-label={title}>
      <header className="kv-journey__head">
        <span className="kv-cell" style={{ '--cell': keyColor(record.key) } as CSSProperties} />
        <h4>{title}</h4>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {j.close}
        </Button>
      </header>
      <dl className="kv-facts">
        <div>
          <dt>{j.key}</dt>
          <dd>{record.key ?? j.none}</dd>
        </div>
        <div>
          <dt>{j.value}</dt>
          <dd>{record.value ?? j.none}</dd>
        </div>
      </dl>
      <p className="kv-journey__calc">
        {positive === null
          ? format(j.sticky, { partition: p.id })
          : format(j.hash, {
              key: record.key ?? '',
              hash: hash ?? 0,
              positive,
              n,
              partition: positive % n,
            })}
      </p>
      <ul className="kv-journey__replicas">
        {p.replicas.map((b) => {
          const log = p.logs.get(b);
          const copy = log?.read(offset, offset + 1)[0];
          const has = copy === record;
          return (
            <li key={b} className={cx(!has && 'kv-journey__missing')}>
              {format(j.copy, { broker: b })}
              {b === p.leader && ` (${j.leaderCopy})`}:{' '}
              {!has ? j.missing : offset < (log?.flushedOffset ?? 0) ? j.onDisk : j.inCache}
            </li>
          );
        })}
      </ul>
      {trace ? (
        <ol className="kv-journey__steps">
          {lines.map((l, i) => (
            <li key={i} className={cx(l.tone && `kv-journey__step--${l.tone}`)}>
              <time>{clock(l.at)}</time> {l.text}
            </li>
          ))}
          {pending.map((text) => (
            <li key={text} className="kv-journey__step--pending">
              {text}
            </li>
          ))}
        </ol>
      ) : (
        <p className="kv-muted">{j.unknown}</p>
      )}
    </section>
  );
}
