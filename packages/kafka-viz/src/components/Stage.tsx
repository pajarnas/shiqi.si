import {
  partitionForKey,
  type Broker,
  type Cluster,
  type Group,
  type Member,
  type Partition,
  type Producer,
} from '@shiqi/kafka';
import { Button, cx, PixelIcon, Term } from '@shiqi/ui';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { anchorId, anchorRef, type AnchorRegistry } from '../anchors';
import { bytes, meterScale } from '../format';
import { keyColor } from '../keys';
import { format, useKafkaStrings } from '../strings';
import { LogStrip } from './LogStrip';
import { PacketLayer } from './PacketLayer';

export interface Selection {
  topic: string;
  partition: number;
}

const STRIP_CELLS = 14;
/** Full scale of the network meters, bytes per simulated second. */
const NET_SCALE = 2048;
/** Full scale of the page-cache meter: dirty bytes waiting for writeback. */
const CACHE_SCALE = 2048;
/** Smallest visible fill of a meter that isn't empty. */
const MIN_FILL = 0.02;
const FOCUS_CLASS = 'lab-focus';

interface StageProps {
  cluster: Cluster;
  speed: number;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
  /** Anchor ids to point at (a scenario step's subject). */
  focus?: readonly string[];
}

/**
 * The live picture: producers on the left, brokers in the middle with every
 * replica's log, consumer groups on the right, and records flying between.
 */
export function Stage({ cluster, speed, selected, onSelect, focus = [] }: StageProps) {
  const t = useKafkaStrings();
  const stageRef = useRef<HTMLDivElement>(null);
  const [anchors] = useState<AnchorRegistry>(() => new Map());
  const producers = [...cluster.producers.values()];
  const groups = [...cluster.groups.values()];

  // Re-applied after every render: React rewrites class names it owns.
  useEffect(() => {
    const els = focus.map((id) => anchors.get(id)).filter((el) => el !== undefined);
    for (const el of els) el.classList.add(FOCUS_CLASS);
    return () => {
      for (const el of els) el.classList.remove(FOCUS_CLASS);
    };
  });

  const diskScale = meterScale(
    Math.max(0, ...[...cluster.brokers.keys()].map((id) => diskBytes(cluster, id))),
    CACHE_SCALE,
  );

  return (
    <div className="kv-stage" ref={stageRef}>
      <section className="kv-lane kv-lane--producers" aria-label={t.lanes.producers}>
        <h2 className="kv-lane__title">{t.lanes.producers}</h2>
        {producers.length === 0 && <p className="kv-muted">{t.lanes.noProducers}</p>}
        {producers.map((p) => (
          <ProducerCard key={p.id} cluster={cluster} producer={p} anchors={anchors} />
        ))}
      </section>

      <section className="kv-lane kv-lane--cluster" aria-label={t.lanes.cluster}>
        <h2 className="kv-lane__title">{t.lanes.cluster}</h2>
        <div className="kv-brokers">
          {[...cluster.brokers.values()].map((b) => (
            <BrokerCard
              key={b.id}
              cluster={cluster}
              broker={b}
              diskScale={diskScale}
              anchors={anchors}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>

      <section className="kv-lane kv-lane--groups" aria-label={t.lanes.consumers}>
        <h2 className="kv-lane__title">{t.lanes.consumers}</h2>
        {groups.length === 0 && <p className="kv-muted">{t.lanes.noGroups}</p>}
        {groups.map((g) => (
          <GroupCard key={g.id} cluster={cluster} group={g} anchors={anchors} />
        ))}
      </section>

      <PacketLayer cluster={cluster} anchors={anchors} stageRef={stageRef} speed={speed} />
    </div>
  );
}

function Meter({
  label,
  value,
  max,
  text,
  hint,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  text: string;
  hint?: string;
  tone?: 'dirty';
}) {
  // Anything above zero shows at least a sliver, so a small amount never reads as empty.
  const fill = value > 0 ? Math.max(MIN_FILL, Math.min(1, value / max)) : 0;
  return (
    <div className={cx('kv-meter', tone && `kv-meter--${tone}`)} title={hint}>
      <span className="kv-meter__label">{label}</span>
      <span
        className="kv-meter__bar"
        style={{ '--fill': fill } as CSSProperties}
        aria-hidden="true"
      />
      <span className="kv-meter__value">{text}</span>
    </div>
  );
}

/** Bytes of log this broker keeps on disk, over all its replicas. */
const diskBytes = (c: Cluster, id: number) =>
  c.allPartitions().reduce((s, p) => s + (p.logs.get(id)?.sizeBytes ?? 0), 0);

function BrokerCard({
  cluster,
  broker,
  diskScale,
  anchors,
  selected,
  onSelect,
}: {
  cluster: Cluster;
  broker: Broker;
  /** Shared by every broker card, so their disk bars compare. */
  diskScale: number;
  anchors: AnchorRegistry;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const t = useKafkaStrings();
  const replicas = cluster.allPartitions().filter((p) => p.replicas.includes(broker.id));
  const disk = diskBytes(cluster, broker.id);
  const dirty = cluster.dirtyBytes(broker.id);
  const isController = cluster.controller === broker.id;
  const busy = broker.up && broker.inRate + broker.outRate > 1;

  return (
    <article
      ref={anchorRef(anchors, anchorId.broker(broker.id))}
      className={cx('kv-broker', !broker.up && 'kv-broker--down', broker.slow && 'kv-broker--slow')}
    >
      <header className="kv-broker__head">
        <span
          className={cx('kv-led', broker.up ? 'kv-led--on' : 'kv-led--off')}
          title={broker.up ? t.broker.up : t.broker.down}
        />
        <span
          className={cx('kv-led', 'kv-led--activity', busy && 'kv-led--blink')}
          title={t.legend.activity}
        />
        <h3 className="kv-broker__name">{format(t.broker.title, { id: broker.id })}</h3>
        {isController && (
          <span className="kv-tag kv-tag--controller" title={t.broker.controller}>
            <PixelIcon name="star" size={12} />
            {t.broker.controller}
          </span>
        )}
      </header>
      <p className="kv-broker__status">
        {!broker.up ? t.broker.down : broker.slow ? t.broker.slow : t.broker.up}
        {broker.rack && ` · ${broker.rack}`}
      </p>

      <div className="kv-broker__meters">
        <Meter
          label={t.broker.netIn}
          value={broker.inRate}
          max={NET_SCALE}
          text={`${bytes(broker.inRate)}/s`}
        />
        <Meter
          label={t.broker.netOut}
          value={broker.outRate}
          max={NET_SCALE}
          text={`${bytes(broker.outRate)}/s`}
        />
        <Meter label={t.broker.disk} value={disk} max={diskScale} text={bytes(disk)} />
        <Meter
          label={t.broker.pageCache}
          value={dirty}
          max={CACHE_SCALE}
          text={bytes(dirty)}
          hint={t.broker.pageCacheHint}
          tone="dirty"
        />
      </div>

      <ul className="kv-broker__replicas">
        {replicas.length === 0 && <li className="kv-muted">{t.broker.empty}</li>}
        {replicas.map((p) => (
          <ReplicaRow
            key={`${p.topic}-${p.id}`}
            cluster={cluster}
            partition={p}
            broker={broker}
            anchors={anchors}
            selected={selected?.topic === p.topic && selected.partition === p.id}
            onSelect={onSelect}
          />
        ))}
      </ul>

      <footer className="kv-broker__actions">
        {broker.up ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => cluster.stopBroker(broker.id)}>
              {t.broker.stop}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cluster.stopBroker(broker.id, { hard: true })}
            >
              {t.broker.powerCut}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => cluster.restartBroker(broker.id)}>
              {t.broker.restart}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cluster.setBrokerSlow(broker.id, !broker.slow)}
            >
              {broker.slow ? t.broker.makeFast : t.broker.makeSlow}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="accent" onClick={() => cluster.startBroker(broker.id)}>
            {t.broker.start}
          </Button>
        )}
      </footer>
    </article>
  );
}

function ReplicaRow({
  cluster,
  partition: p,
  broker,
  anchors,
  selected,
  onSelect,
}: {
  cluster: Cluster;
  partition: Partition;
  broker: Broker;
  anchors: AnchorRegistry;
  selected: boolean;
  onSelect: (s: Selection) => void;
}) {
  const t = useKafkaStrings();
  const log = p.logs.get(broker.id);
  if (!log) return null;
  const isLeader = p.leader === broker.id;
  const inSync = p.isr.includes(broker.id);
  const offline = p.leader === null;
  const role = offline ? 'offline' : isLeader ? 'leader' : inSync ? 'follower' : 'out';
  const roleText = {
    offline: t.broker.offline,
    leader: t.broker.leader,
    follower: t.broker.follower,
    out: t.broker.outOfSync,
  }[role];
  const leaderLog = cluster.leaderLog(p);
  const end = Math.max(leaderLog?.logEndOffset ?? 0, log.logEndOffset);
  const from = Math.max(0, end - STRIP_CELLS);

  return (
    <li>
      <button
        type="button"
        ref={anchorRef(anchors, anchorId.replica(p.topic, p.id, broker.id))}
        className={cx('kv-replica', `kv-replica--${role}`, selected && 'kv-replica--selected')}
        onClick={() => onSelect({ topic: p.topic, partition: p.id })}
        aria-pressed={selected}
        aria-label={format(t.broker.replica, {
          topic: p.topic,
          partition: p.id,
          role: roleText,
          leo: log.logEndOffset,
          hw: p.highWatermark,
        })}
      >
        <span
          className="kv-replica__name"
          title={format(t.broker.partitionFull, { topic: p.topic, partition: p.id })}
        >
          {p.topic} <b>{format(t.broker.partitionShort, { partition: p.id })}</b>
        </span>
        <span className="kv-replica__role" title={roleText}>
          {role === 'leader' ? 'L' : role === 'follower' ? 'F' : '×'}
        </span>
        <LogStrip
          log={log}
          from={from}
          to={from + STRIP_CELLS}
          highWatermark={p.highWatermark}
          leader={leaderLog}
          ownHighWatermark={isLeader ? undefined : log.highWatermark}
        />
        <span className="kv-replica__leo" title={t.legend.leo}>
          {log.logEndOffset}
        </span>
      </button>
    </li>
  );
}

/** Records stuck in the producer, and how close the oldest is to delivery.timeout.ms. */
function BufferMeter({ cluster, producer: p }: { cluster: Cluster; producer: Producer }) {
  const t = useKafkaStrings();
  const timeout = cluster.settings.deliveryTimeoutMs;
  const age = cluster.now - (p.buffered[0]?.at ?? cluster.now);
  const sec = (ms: number) => Math.round(ms / 1000);
  const noLeaderAnywhere = !!cluster.topics
    .get(p.topic)
    ?.partitions.every((x) => x.leader === null);
  return (
    <div className="kv-client__buffer">
      <p className="kv-client__line">
        {format(noLeaderAnywhere ? t.producer.bufferedAll : t.producer.buffered, {
          n: p.buffered.length,
          topic: p.topic,
          partitions: [...new Set(p.buffered.map((r) => r.partition))]
            .sort((a, b) => a - b)
            .map((n) => `${p.topic}-${n}`)
            .join(', '),
          timeout: sec(timeout),
        })}
      </p>
      <Meter
        label="⏱"
        value={age}
        max={timeout}
        text={`${sec(age)}/${sec(timeout)}s`}
        hint={format(t.producer.bufferAge, { age: sec(age), timeout: sec(timeout) })}
        tone="dirty"
      />
    </div>
  );
}

/** Which key goes to which partition, in the key's own colour, so a record can be followed. */
function KeyMap({ cluster, producer: p }: { cluster: Cluster; producer: Producer }) {
  const t = useKafkaStrings().producer.keyMap;
  const n = cluster.topics.get(p.topic)?.partitions.length ?? 0;
  if (p.keys !== 'fixed' || n === 0)
    return <p className="kv-client__line kv-muted">{format(t[p.keys], { n })}</p>;
  return (
    <div className="kv-keymap">
      <p className="kv-client__line kv-muted">{format(t.fixed, { n })}</p>
      <ul className="kv-keymap__list">
        {p.keySet.map((key) => {
          const partition = partitionForKey(key, n);
          return (
            <li
              key={key}
              className="kv-keymap__key"
              title={format(t.chip, { key, topic: p.topic, partition })}
            >
              <span className="kv-swatch" style={{ background: keyColor(key) }} />
              {key} → {partition}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProducerCard({
  cluster,
  producer: p,
  anchors,
}: {
  cluster: Cluster;
  producer: Producer;
  anchors: AnchorRegistry;
}) {
  const t = useKafkaStrings();
  return (
    <article
      ref={anchorRef(anchors, anchorId.producer(p.id))}
      className={cx(
        'kv-client',
        p.paused && 'kv-client--paused',
        p.buffered.length > 0 && 'kv-client--waiting',
      )}
    >
      <header className="kv-client__head">
        <PixelIcon name="envelope" size={16} />
        <h3>{format(t.producer.title, { id: p.id })}</h3>
      </header>
      <p className="kv-client__line">
        → <b>{p.topic}</b> · {format(t.producer.rate, { rate: p.rate })} ·{' '}
        <span className="kv-tag">{format(t.producer.acks, { acks: String(p.acks) })}</span>
      </p>
      <KeyMap cluster={cluster} producer={p} />
      {cluster.authorizer && <p className="kv-client__line kv-muted">{p.principal}</p>}
      <p className="kv-client__line kv-muted">
        {format(t.producer.stats, { sent: p.sent, acked: p.acked, failed: p.failed })}
      </p>
      {p.buffered.length > 0 && <BufferMeter cluster={cluster} producer={p} />}
      {p.lastError && (
        <p className="kv-client__line kv-error">
          {format(t.producer.lastError, { error: p.lastError })}
        </p>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => cluster.updateProducer(p.id, { paused: !p.paused })}
      >
        {p.paused ? t.producer.resume : t.producer.pause}
      </Button>
    </article>
  );
}

function memberLag(
  cluster: Cluster,
  m: Member,
  topic: string,
  partition: number,
): number | undefined {
  const pos = m.positions.get(`${topic}-${partition}`);
  const p = cluster.topics.get(topic)?.partitions[partition];
  return pos === undefined || !p ? undefined : Math.max(0, p.highWatermark - pos);
}

function GroupCard({
  cluster,
  group: g,
  anchors,
}: {
  cluster: Cluster;
  group: Group;
  anchors: AnchorRegistry;
}) {
  const t = useKafkaStrings();
  const h = t.group.hints;
  const members = [...g.members.values()];
  const total = members.reduce(
    (s, m) =>
      s +
      m.assignment.reduce((x, tp) => x + (memberLag(cluster, m, tp.topic, tp.partition) ?? 0), 0),
    0,
  );
  return (
    <article
      ref={anchorRef(anchors, anchorId.group(g.id))}
      className={cx('kv-group', `kv-group--${g.state}`)}
    >
      <header className="kv-group__head">
        <h3>
          <Term definition={h.name}>{g.id}</Term>
        </h3>
        <span className="kv-tag">
          <Term definition={h.state}>{t.group.state[g.state]}</Term>
        </span>
      </header>
      <p className="kv-muted kv-group__meta">
        <Term definition={h.assignor}>{g.assignor}</Term> ·{' '}
        <Term definition={h.generation}>{format(t.group.generation, { n: g.generation })}</Term> ·{' '}
        <Term definition={h.totalLag}>{format(t.group.totalLag, { n: total })}</Term>
      </p>
      {g.redelivered > 0 && (
        <p className="kv-error kv-group__meta">
          {format(t.group.redelivered, { n: g.redelivered })}
        </p>
      )}

      <ul className="kv-group__members">
        {members.map((m) => (
          <li
            key={m.id}
            ref={anchorRef(anchors, anchorId.member(g.id, m.id))}
            className={cx('kv-member', !m.alive && 'kv-member--dead')}
          >
            <div className="kv-member__head">
              <PixelIcon name={m.alive ? 'face' : 'blob'} size={16} />
              <span className="kv-member__name">
                <Term definition={format(h.member, { n: m.instance, clientId: m.clientId })}>
                  {format(t.group.instance, { n: m.instance })}
                </Term>
              </span>
              <span className="kv-muted">
                <Term definition={h.rate}>{format(t.group.rate, { rate: m.rate })}</Term>
              </span>
            </div>
            {!m.alive && <p className="kv-error kv-member__note">{t.group.crashed}</p>}
            {cluster.authorizer && <p className="kv-muted kv-member__note">{m.principal}</p>}
            {m.error && (
              <p className="kv-error kv-member__note">
                {format(t.group.authError, { error: m.error })}
              </p>
            )}
            {m.assignment.length === 0 ? (
              <p className="kv-muted kv-member__note">{t.group.noPartitions}</p>
            ) : (
              <ul className="kv-member__parts">
                {m.assignment.map((tp) => {
                  const lag = memberLag(cluster, m, tp.topic, tp.partition);
                  return (
                    <li
                      key={`${tp.topic}-${tp.partition}`}
                      ref={anchorRef(anchors, anchorId.owned(g.id, m.id, tp.topic, tp.partition))}
                      className={cx('kv-chip', (lag ?? 0) > 20 && 'kv-chip--hot')}
                    >
                      <Term
                        definition={format(h.partition, {
                          topic: tp.topic,
                          partition: tp.partition,
                        })}
                      >
                        {tp.topic} {format(t.broker.partitionShort, { partition: tp.partition })}
                      </Term>
                      {lag !== undefined && <span>{format(t.group.lag, { n: lag })}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="kv-member__actions">
              <Button size="sm" variant="ghost" onClick={() => cluster.removeConsumer(g.id, m.id)}>
                {t.group.leave}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!m.alive}
                onClick={() => cluster.crashConsumer(g.id, m.id)}
              >
                {t.group.crash}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
