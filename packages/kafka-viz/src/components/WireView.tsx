import type { Cluster, ClusterEvent } from '@shiqi/kafka';
import { cx } from '@shiqi/ui';
import { preciseClock } from '../format';
import { format, useKafkaStrings, type KafkaStrings } from '../strings';
import type { Selection } from './Stage';

const ROWS = 16;
const COL = 150;
const ROW = 30;
const HEAD = 34;
const PAD = 70;

type Actor = { id: string; label: string; kind: 'producer' | 'broker' | 'group' };
interface Row {
  at: number;
  from: string;
  to: string;
  label: string;
  tone?: 'data' | 'bad' | 'meta';
}

const vars = (e: object): Record<string, string | number> =>
  Object.fromEntries(
    Object.entries(e).map(([k, v]) => [k, typeof v === 'number' ? v : String(v ?? '∅')]),
  );

const brokerActor = (id: number | null | undefined) => `b:${id ?? '?'}`;

/** One event as a request between two actors, if it belongs to this partition. */
function rowFor(
  e: ClusterEvent,
  c: Cluster,
  sel: Selection,
  w: KafkaStrings['wire'],
  reasons: KafkaStrings['events']['truncateReasons'],
): Row | null {
  const here =
    'topic' in e && e.topic === sel.topic && 'partition' in e && e.partition === sel.partition;
  const v = vars(e);
  const p = c.topics.get(sel.topic)?.partitions[sel.partition];
  switch (e.type) {
    case 'produce':
      return here
        ? {
            at: e.at,
            from: `p:${e.producer}`,
            to: brokerActor(e.broker),
            label: format(w.produce, v),
            tone: 'data',
          }
        : null;
    case 'ack':
      return here
        ? {
            at: e.at,
            from: brokerActor(p?.leader ?? p?.replicas[0]),
            to: `p:${e.producer}`,
            label: format(e.error ? w.ackError : w.ackOk, v),
            tone: e.error ? 'bad' : undefined,
          }
        : null;
    case 'replicate':
      return here
        ? {
            at: e.at,
            from: brokerActor(e.to),
            to: brokerActor(e.from),
            label: format(w.fetch, v),
            tone: 'data',
          }
        : null;
    case 'consume':
      return here
        ? {
            at: e.at,
            from: `g:${e.group}`,
            to: brokerActor(e.broker),
            label: format(w.consume, v),
            tone: 'data',
          }
        : null;
    case 'commit':
      return here
        ? {
            at: e.at,
            from: `g:${e.group}`,
            to: brokerActor(c.coordinator(e.group)),
            label: format(w.commit, v),
          }
        : null;
    case 'leader-elected':
      return here
        ? {
            at: e.at,
            from: brokerActor(c.controller),
            to: brokerActor(e.leader ?? c.controller),
            label: format(w.leader, v),
            tone: 'meta',
          }
        : null;
    case 'truncate':
      if (!here) return null;
      return e.reason === 'epoch'
        ? {
            at: e.at,
            from: brokerActor(e.broker),
            to: brokerActor(p?.leader),
            label: format(w.epochQuery, v),
            tone: 'bad',
          }
        : {
            at: e.at,
            from: brokerActor(e.broker),
            to: brokerActor(e.broker),
            label: format(w.truncate, { ...v, reason: reasons[e.reason] }),
            tone: 'bad',
          };
    case 'rebalance-start':
    case 'rebalance-end': {
      const g = c.groups.get(e.group);
      const reads = g && [...g.members.values()].some((m) => m.topics.includes(sel.topic));
      if (!reads) return null;
      const coord = brokerActor(c.coordinator(e.group));
      return e.type === 'rebalance-start'
        ? {
            at: e.at,
            from: `g:${e.group}`,
            to: coord,
            label: format(w.join, { reason: e.reason }),
            tone: 'meta',
          }
        : { at: e.at, from: coord, to: `g:${e.group}`, label: format(w.sync, v), tone: 'meta' };
    }
    default:
      return null;
  }
}

/**
 * A sequence diagram of the requests behind one partition: Produce, follower
 * and consumer Fetch, OffsetCommit, JoinGroup/SyncGroup, leader changes and
 * OffsetsForLeaderEpoch. Time runs down the page.
 */
export function WireView({ cluster, selected }: { cluster: Cluster; selected: Selection | null }) {
  const t = useKafkaStrings();
  const w = t.wire;
  if (!selected) return <p className="kv-muted">{w.pick}</p>;
  const rows: Row[] = [];
  for (let i = cluster.events.length - 1; i >= 0 && rows.length < ROWS; i--) {
    const row = rowFor(
      cluster.events[i] as ClusterEvent,
      cluster,
      selected,
      w,
      t.events.truncateReasons,
    );
    if (row) rows.unshift(row);
  }
  if (rows.length === 0) return <p className="kv-muted">{w.empty}</p>;

  const ids = new Set(rows.flatMap((r) => [r.from, r.to]));
  const actors: Actor[] = [...ids]
    .map((id): Actor => {
      const [kind, name = ''] = [id.slice(0, 1), id.slice(2)];
      if (kind === 'b') {
        const n = Number(name);
        const tags = [n === cluster.controller && w.controller].filter(Boolean).join(', ');
        return {
          id,
          kind: 'broker',
          label: `${format(t.broker.title, { id: name })}${tags ? ` · ${tags}` : ''}`,
        };
      }
      return { id, kind: kind === 'p' ? 'producer' : 'group', label: name };
    })
    .sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label));
  const x = new Map(actors.map((a, i) => [a.id, PAD + i * COL + COL / 2]));
  const width = PAD + actors.length * COL;
  const height = HEAD + rows.length * ROW + 10;

  return (
    <div className="kv-wire">
      <p className="kv-muted">
        {format(w.intro, { topic: selected.topic, partition: selected.partition })}
      </p>
      <div className="kv-wire__scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={t.panels.wire}
        >
          <defs>
            <marker
              id="kv-wire-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" className="kv-wire__head" />
            </marker>
          </defs>
          {actors.map((a) => (
            <g key={a.id} className={`kv-wire__actor kv-wire__actor--${a.kind}`}>
              <text x={x.get(a.id)} y={16} textAnchor="middle">
                {a.label}
              </text>
              <line x1={x.get(a.id)} x2={x.get(a.id)} y1={HEAD - 8} y2={height} />
            </g>
          ))}
          {rows.map((r, i) => {
            const y = HEAD + i * ROW + ROW / 2 + 4;
            const x1 = x.get(r.from) ?? 0;
            const x2 = x.get(r.to) ?? 0;
            const self = r.from === r.to;
            return (
              <g key={i} className={cx('kv-wire__msg', r.tone && `kv-wire__msg--${r.tone}`)}>
                <text x={4} y={y + 4} className="kv-wire__time">
                  {preciseClock(r.at)}
                </text>
                {self ? (
                  <path
                    d={`M${x1},${y - 6} h18 v12 h-18`}
                    markerEnd="url(#kv-wire-arrow)"
                    fill="none"
                  />
                ) : (
                  <line
                    x1={x1}
                    x2={x2 + (x2 > x1 ? -3 : 3)}
                    y1={y}
                    y2={y}
                    markerEnd="url(#kv-wire-arrow)"
                  />
                )}
                <text
                  x={self ? x1 + 24 : (x1 + x2) / 2}
                  y={self ? y + 4 : y - 5}
                  textAnchor={self ? 'start' : 'middle'}
                >
                  {r.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const order = (a: Actor) => (a.kind === 'producer' ? 0 : a.kind === 'broker' ? 1 : 2);
