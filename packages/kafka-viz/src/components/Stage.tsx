import type { Broker, Cluster, Group, Member, Partition, Producer } from '@shiqi/kafka';
import { Button, cx, PixelIcon } from '@shiqi/ui';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { anchorId, anchorRef, type AnchorRegistry } from '../anchors';
import { bytes } from '../format';
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
const FOCUS_CLASS = 'kv-focus';

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
  const fill = Math.max(0, Math.min(1, value / max));
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

function BrokerCard({
  cluster,
  broker,
  anchors,
  selected,
  onSelect,
}: {
  cluster: Cluster;
  broker: Broker;
  anchors: AnchorRegistry;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const t = useKafkaStrings();
  const replicas = cluster.allPartitions().filter((p) => p.replicas.includes(broker.id));
  const disk = replicas.reduce((s, p) => s + (p.logs.get(broker.id)?.sizeBytes ?? 0), 0);
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
        <Meter label={t.broker.disk} value={disk} max={64 * 1024} text={bytes(disk)} />
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
        <span className="kv-replica__name">
          {p.topic}
          <b>-{p.id}</b>
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
  return (
    <div className="kv-client__buffer">
      <p className="kv-client__line">
        {format(t.producer.buffered, { n: p.buffered.length, timeout: sec(timeout) })}
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
      <p className="kv-client__line kv-muted">{t.producer.keys[p.keys]}</p>
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
        <h3>{g.id}</h3>
        <span className="kv-tag">{t.group.state[g.state]}</span>
      </header>
      <p className="kv-muted kv-group__meta">
        {g.assignor} · {format(t.group.generation, { n: g.generation })} ·{' '}
        {format(t.group.totalLag, { n: total })}
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
              <span className="kv-member__name" title={m.id}>
                {m.clientId}
              </span>
              <span className="kv-muted">{format(t.group.rate, { rate: m.rate })}</span>
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
                      className={cx('kv-chip', (lag ?? 0) > 20 && 'kv-chip--hot')}
                    >
                      {tp.topic}-{tp.partition}
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
