import { segmentFileName, type Cluster } from '@shiqi/kafka';
import { cx } from '@shiqi/ui';
import { useState } from 'react';
import { bytes } from '../format';
import { format, useKafkaStrings } from '../strings';
import { LogStrip } from './LogStrip';
import { RecordJourney } from './RecordJourney';
import type { Selection } from './Stage';

const DRAWN = 32;

/**
 * Inside one partition: the facts the controller keeps (leader, epoch, ISR),
 * then each replica's log as segment files with offsets, the high watermark
 * and every group's committed offset.
 */
export function Inspector({ cluster, selected }: { cluster: Cluster; selected: Selection | null }) {
  const t = useKafkaStrings();
  const [picked, setPicked] = useState<{ key: string; broker: number; offset: number } | null>(
    null,
  );
  const p = selected && cluster.topics.get(selected.topic)?.partitions[selected.partition];
  if (!p) return <p className="kv-muted">{t.inspect.pick}</p>;
  const here = `${p.topic}-${p.id}`;
  const pick = picked?.key === here ? picked : null;

  const leader = cluster.leaderLog(p);
  const end = Math.max(0, ...[...p.logs.values()].map((l) => l.logEndOffset));
  const from = Math.max(0, end - DRAWN);
  const pins = [...cluster.groups.values()].flatMap((g) => {
    const offset = g.committed.get(`${p.topic}-${p.id}`);
    return offset === undefined
      ? []
      : [{ offset, label: format(t.inspect.committed, { group: g.id }) }];
  });

  const facts: [string, string | number][] = [
    [t.inspect.leader, p.leader ?? t.inspect.none],
    [t.inspect.epoch, p.leaderEpoch],
    [t.inspect.replicas, p.replicas.join(', ')],
    [t.inspect.isr, p.isr.join(', ')],
    [t.inspect.start, leader?.logStartOffset ?? '-'],
    [t.inspect.hw, p.highWatermark],
    [t.inspect.leo, leader?.logEndOffset ?? '-'],
  ];

  return (
    <div className="kv-inspector">
      <h3 className="kv-inspector__title">
        {format(t.inspect.title, { topic: p.topic, partition: p.id })}
      </h3>
      <dl className="kv-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {p.gone > 0 && (
        <p className="kv-error">{format(t.inspect.gone, { gone: p.gone, acked: p.goneAcked })}</p>
      )}
      <p className="kv-muted">{t.inspect.pickRecord}</p>

      {pick && (
        <RecordJourney
          cluster={cluster}
          partition={p}
          broker={pick.broker}
          offset={pick.offset}
          onClose={() => setPicked(null)}
        />
      )}

      {p.replicas.map((id) => {
        const log = p.logs.get(id);
        if (!log) return null;
        const role = p.leader === id ? 'leader' : p.isr.includes(id) ? 'follower' : 'out';
        return (
          <section key={id} className={cx('kv-disk', `kv-disk--${role}`)}>
            <h4>
              {format(t.inspect.segments, { id })}{' '}
              <span className="kv-tag">
                {role === 'leader'
                  ? t.inspect.leader
                  : role === 'follower'
                    ? 'ISR'
                    : t.inspect.none}
              </span>
            </h4>
            <LogStrip
              log={log}
              from={from}
              to={end}
              highWatermark={p.highWatermark}
              leader={leader}
              ownHighWatermark={role === 'leader' ? undefined : log.highWatermark}
              pins={pins}
              size="lg"
              showOffsets
              picked={pick?.broker === id ? pick.offset : null}
              onPick={(offset) => setPicked({ key: here, broker: id, offset })}
            />
            {role !== 'leader' && (
              <p className="kv-muted" title={t.inspect.ownHwHint}>
                {format(t.inspect.ownHw, { hw: log.highWatermark })}
              </p>
            )}
            {from > log.logStartOffset && (
              <p className="kv-muted">
                {format(t.inspect.hidden, { n: from - log.logStartOffset })}
              </p>
            )}
            <ul className="kv-files">
              {log.segments.map((s, i) => (
                <li
                  key={s.baseOffset}
                  className={cx(i === log.segments.length - 1 && 'kv-files__active')}
                >
                  <code>{segmentFileName(s.baseOffset)}</code>
                  <span>{format(t.inspect.records, { n: s.records.length })}</span>
                  <span>{bytes(s.bytes)}</span>
                  <code className="kv-muted">.index .timeindex</code>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="kv-legend-line">
        <span className="kv-swatch kv-swatch--hw" /> {t.inspect.legendHw} ·{' '}
        <span className="kv-swatch kv-swatch--leo" /> {t.inspect.legendLeo} ·{' '}
        <span className="kv-swatch kv-swatch--dirty" /> {t.inspect.legendDirty} ·{' '}
        <span className="kv-swatch kv-swatch--diverged" /> {t.inspect.legendDiverged}
        {pins.length > 0 && (
          <>
            {' '}
            · <span className="kv-swatch kv-swatch--pin" /> {pins.map((x) => x.label).join(', ')}
          </>
        )}
      </p>
    </div>
  );
}
