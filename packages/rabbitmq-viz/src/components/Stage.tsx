import {
  DEFAULT_EXCHANGE,
  type Broker,
  type BrokerEvent,
  type Consumer,
  type Delivery,
  type Exchange,
  type Publisher,
  type Queue,
  type QueueArgs,
} from '@shiqi/rabbitmq';
import { LabAction } from '@shiqi/lab';
import {
  anchorRef,
  Button,
  cx,
  FlowLayer,
  format,
  Term,
  type AnchorRegistry,
  type FlowLayerHandle,
  type FlowLink,
  type FlowPacket,
} from '@shiqi/ui';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { anchorId } from '../anchors';
import { useRabbitStrings } from '../i18n';
import { keyColor, keyVar } from '../keys';
import type { RabbitStrings } from '../strings';

/** Most ready messages a queue card draws; the rest are a count. */
const STRIP_CELLS = 12;
const FOCUS_CLASS = 'lab-focus';

interface StageProps {
  broker: Broker;
  speed: number;
  selected: string | null;
  onSelect: (queue: string) => void;
  /** Anchor ids to point at (a story step's subject). */
  focus?: readonly string[];
}

/** Which exchanges to draw: the ones in use, not every amq.* the broker starts with. */
function visibleExchanges(b: Broker): Exchange[] {
  const used = new Set<string>();
  for (const p of b.publishers.values()) used.add(p.exchange);
  for (const x of b.bindings) {
    used.add(x.source);
    if (x.destinationType === 'exchange') used.add(x.destination);
  }
  for (const x of b.exchanges.values()) if (x.alternate) used.add(x.alternate);
  for (const q of b.queues.values())
    if (q.args.deadLetterExchange) used.add(q.args.deadLetterExchange);
  return [...b.exchanges.values()].filter((x) => !x.builtin || used.has(x.name));
}

/** A binding key as drawn on its line. */
function bindingLabel(
  b: Broker,
  source: string,
  key: string,
  args: Record<string, string>,
  t: RabbitStrings,
) {
  const type = b.exchanges.get(source)?.type;
  if (type === 'fanout') return t.exchange.all;
  if (type === 'headers') {
    const pairs = Object.entries(args).filter(([k]) => !k.startsWith('x-'));
    return format(t.exchange.headersMatch, {
      mode: args['x-match'] ?? 'all',
      pairs: pairs.map(([k, v]) => `${k}=${v}`).join(' '),
    });
  }
  return key || '""';
}

/** Lines between cards: who publishes where, bindings, alternates, dead letters, subscriptions. */
function linksOf(b: Broker, t: RabbitStrings): FlowLink[] {
  const out: FlowLink[] = [];
  for (const p of b.publishers.values())
    out.push({
      from: anchorId.publisher(p.id),
      to: anchorId.exchange(p.exchange),
      color: '--rv-wire',
      dashed: true,
    });
  // The default exchange's bindings are implicit: draw the ones publishers use.
  for (const p of b.publishers.values())
    if (p.exchange === DEFAULT_EXCHANGE)
      for (const k of new Set(p.keys))
        if (b.queues.has(k))
          out.push({
            from: anchorId.exchange(''),
            to: anchorId.queue(k),
            color: '--rv-binding',
            label: k,
          });
  for (const x of b.bindings)
    out.push({
      from: anchorId.exchange(x.source),
      to:
        x.destinationType === 'queue'
          ? anchorId.queue(x.destination)
          : anchorId.exchange(x.destination),
      color: '--rv-binding',
      label: bindingLabel(b, x.source, x.routingKey, x.args, t),
    });
  for (const x of b.exchanges.values())
    if (x.alternate && b.exchanges.has(x.alternate))
      out.push({
        from: anchorId.exchange(x.name),
        to: anchorId.exchange(x.alternate),
        color: '--rv-binding',
        dashed: true,
        label: 'AE',
      });
  for (const q of b.queues.values()) {
    const dlx = q.args.deadLetterExchange;
    if (dlx && b.exchanges.has(dlx))
      out.push({
        from: anchorId.queue(q.name),
        to: anchorId.exchange(dlx),
        color: '--rv-dead',
        dashed: true,
        label: 'DLX',
      });
  }
  for (const c of b.consumers.values())
    if (!c.down)
      out.push({
        from: anchorId.queue(c.queue),
        to: anchorId.consumer(c.tag),
        color: '--rv-consume',
        dashed: true,
        hotWith: [anchorId.consumer(c.tag)],
      });
  return out;
}

/** What flies across the stage for an event, if anything. */
function packetsFor(
  e: BrokerEvent,
  b: Broker,
  keyOf: Map<number, string>,
): Omit<FlowPacket, 'duration'>[] {
  const color = (id: number) => keyVar(keyOf.get(id) ?? '');
  switch (e.type) {
    case 'publish':
      keyOf.set(e.id, e.key);
      if (keyOf.size > 2000) keyOf.delete(keyOf.keys().next().value as number);
      return e.publisher && b.publishers.has(e.publisher)
        ? [
            {
              from: anchorId.publisher(e.publisher),
              to: anchorId.exchange(e.exchange),
              color: keyVar(e.key),
            },
          ]
        : [];
    case 'route':
      return e.queues.map((name) => ({
        from: anchorId.exchange(e.exchange),
        to: anchorId.queue(name),
        color: keyVar(e.key),
      }));
    case 'unroutable':
      return [
        {
          from: anchorId.exchange(e.exchange),
          to:
            e.outcome === 'returned' && e.publisher
              ? anchorId.publisher(e.publisher)
              : anchorId.exchange(e.exchange),
          color: '--danger',
          shape: 'cross',
        },
      ];
    case 'deliver':
      return [
        {
          from: anchorId.queue(e.queue),
          to: anchorId.consumer(e.consumer),
          color: color(e.id),
          shape: 'dot',
        },
      ];
    case 'ack':
      return [
        {
          from: anchorId.consumer(e.consumer),
          to: anchorId.queue(e.queue),
          color: '--rv-ack',
          shape: 'hollow',
          size: 0,
        },
      ];
    case 'nack':
      return [
        {
          from: anchorId.consumer(e.consumer),
          to: anchorId.queue(e.queue),
          color: '--danger',
          shape: 'cross',
        },
      ];
    case 'dead-letter':
      return [
        {
          from: anchorId.queue(e.queue),
          to: anchorId.exchange(e.exchange),
          color: '--danger',
          shape: 'cross',
        },
      ];
    case 'confirm':
      return e.ok
        ? []
        : [
            {
              from: anchorId.exchange(b.publishers.get(e.publisher)?.exchange ?? ''),
              to: anchorId.publisher(e.publisher),
              color: '--danger',
              shape: 'cross',
            },
          ];
    case 'reject-publish':
      return [
        {
          from: anchorId.queue(e.queue),
          to: anchorId.queue(e.queue),
          color: '--danger',
          shape: 'cross',
        },
      ];
    default:
      return [];
  }
}

/**
 * The live picture: publishers, exchanges, queues and consumers left to right,
 * bindings drawn between them, and messages flying along.
 */
export function Stage({ broker: b, speed, selected, onSelect, focus = [] }: StageProps) {
  const t = useRabbitStrings();
  const stageRef = useRef<HTMLDivElement>(null);
  const flow = useRef<FlowLayerHandle>(null);
  const [anchors] = useState<AnchorRegistry>(() => new Map());
  const speedRef = useRef(speed);
  const tRef = useRef(t);
  useEffect(() => {
    speedRef.current = speed;
    tRef.current = t;
  }, [speed, t]);

  useEffect(() => {
    const keyOf = new Map<number, string>();
    return b.onEvent((e) => {
      const travel =
        e.type === 'route' || e.type === 'unroutable' || e.type === 'reject-publish'
          ? 400
          : b.settings.netMs;
      const duration = Math.max(160, Math.min(2400, travel / speedRef.current));
      for (const p of packetsFor(e, b, keyOf)) flow.current?.send({ ...p, duration });
    });
  }, [b]);

  // Re-applied after every render: React rewrites class names it owns.
  useEffect(() => {
    const els = focus.map((id) => anchors.get(id)).filter((el) => el !== undefined);
    for (const el of els) el.classList.add(FOCUS_CLASS);
    return () => {
      for (const el of els) el.classList.remove(FOCUS_CLASS);
    };
  });

  const publishers = [...b.publishers.values()];
  const queues = [...b.queues.values()];
  const consumers = [...b.consumers.values()];

  return (
    <div className="rv-stage-box">
      <div className="rv-stage" ref={stageRef}>
        <section className="rv-lane" aria-label={t.lanes.publishers}>
          <h2 className="rv-lane__title">{t.lanes.publishers}</h2>
          {publishers.length === 0 && <p className="lab-muted">{t.lanes.noPublishers}</p>}
          {publishers.map((p) => (
            <PublisherCard key={p.id} broker={b} publisher={p} anchors={anchors} />
          ))}
        </section>
        <section className="rv-lane" aria-label={t.lanes.exchanges}>
          <h2 className="rv-lane__title">{t.lanes.exchanges}</h2>
          {visibleExchanges(b).map((x) => (
            <ExchangeCard key={x.name} broker={b} exchange={x} anchors={anchors} />
          ))}
        </section>
        <section className="rv-lane" aria-label={t.lanes.queues}>
          <h2 className="rv-lane__title">{t.lanes.queues}</h2>
          {queues.length === 0 && <p className="lab-muted">{t.lanes.noQueues}</p>}
          {queues.map((q) => (
            <QueueCard
              key={q.name}
              broker={b}
              queue={q}
              anchors={anchors}
              selected={selected === q.name}
              onSelect={() => onSelect(q.name)}
            />
          ))}
        </section>
        <section className="rv-lane" aria-label={t.lanes.consumers}>
          <h2 className="rv-lane__title">{t.lanes.consumers}</h2>
          {consumers.length === 0 && <p className="lab-muted">{t.lanes.noConsumers}</p>}
          {consumers.map((c) => (
            <ConsumerCard key={c.tag} broker={b} consumer={c} anchors={anchors} />
          ))}
        </section>
        <FlowLayer
          ref={flow}
          anchors={anchors}
          stageRef={stageRef}
          links={() => linksOf(b, tRef.current)}
          className="ui-flow rv-flow"
        />
      </div>
    </div>
  );
}

// ── Cards ──────────────────────────────────────────────────────────────────

function PublisherCard({
  broker: b,
  publisher: p,
  anchors,
}: {
  broker: Broker;
  publisher: Publisher;
  anchors: AnchorRegistry;
}) {
  const t = useRabbitStrings();
  const s = t.publisher;
  const onWire = b.inFlightFrom(p.id);
  return (
    <article
      className={cx('rv-card rv-card--publisher', p.paused && 'rv-card--off')}
      ref={anchorRef(anchors, anchorId.publisher(p.id))}
    >
      <header className="rv-card__head">
        <b className="rv-card__name">{p.id}</b>
        <span className="lab-muted">
          {p.rate > 0 && !p.paused ? format(s.rate, { rate: p.rate }) : s.manual}
        </span>
      </header>
      <p className="rv-card__line lab-muted">
        {format(s.to, { exchange: p.exchange || t.exchange.default })}
      </p>
      <ul className="rv-keys" aria-label={s.keys}>
        {[...new Set(p.keys)].map((k) => (
          <li key={k} className="rv-key" style={{ '--rv-key': keyColor(k) } as CSSProperties}>
            {k || '""'}
          </li>
        ))}
      </ul>
      {(p.confirm || p.mandatory) && (
        <p className="rv-tags">
          {p.confirm && <span className="rv-tag">{s.confirm}</span>}
          {p.mandatory && <span className="rv-tag">{s.mandatory}</span>}
        </p>
      )}
      <p className="rv-card__stats">{format(s.stats, p.stats)}</p>
      {onWire > 0 && <p className="rv-card__stats">{format(s.onWire, { n: onWire })}</p>}
      <div className="rv-card__actions">
        <LabAction size="sm" variant="secondary" onClick={() => b.publishFrom(p.id)}>
          {s.sendOne}
        </LabAction>
        {p.rate > 0 && (
          <LabAction
            size="sm"
            variant="ghost"
            onClick={() => b.updatePublisher(p.id, { paused: !p.paused })}
          >
            {p.paused ? s.resume : s.pause}
          </LabAction>
        )}
        <LabAction size="sm" variant="ghost" onClick={() => b.removePublisher(p.id)}>
          {s.remove}
        </LabAction>
      </div>
    </article>
  );
}

function ExchangeCard({
  broker: b,
  exchange: x,
  anchors,
}: {
  broker: Broker;
  exchange: Exchange;
  anchors: AnchorRegistry;
}) {
  const t = useRabbitStrings();
  const s = t.exchange;
  const isDefault = x.name === DEFAULT_EXCHANGE;
  return (
    <article
      className="rv-card rv-card--exchange"
      ref={anchorRef(anchors, anchorId.exchange(x.name))}
    >
      <header className="rv-card__head">
        <b className="rv-card__name">
          {isDefault ? <Term definition={s.defaultHint}>{s.default}</Term> : x.name}
        </b>
        <Term className="rv-tag rv-tag--type" definition={s.types[x.type]}>
          {x.type}
        </Term>
      </header>
      {(x.alternate || x.internal) && (
        <p className="rv-tags">
          {x.alternate && (
            <Term className="rv-tag" definition={format(s.alternateHint, { name: x.alternate })}>
              {format(s.alternate, { name: x.alternate })}
            </Term>
          )}
          {x.internal && <span className="rv-tag">{s.internal}</span>}
        </p>
      )}
      <p className="rv-card__stats">{format(s.stats, x.stats)}</p>
      {!isDefault && (
        <p className="rv-card__stats">{format(s.bindings, { n: b.bindingsFrom(x.name).length })}</p>
      )}
    </article>
  );
}

function QueueCard({
  broker: b,
  queue: q,
  anchors,
  selected,
  onSelect,
}: {
  broker: Broker;
  queue: Queue;
  anchors: AnchorRegistry;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useRabbitStrings();
  const s = t.queue;
  const a = q.args;
  const shown = q.ready.slice(0, STRIP_CELLS);
  const hidden = q.ready.length - shown.length;
  const ttl = a.messageTtl;
  return (
    <article
      className={cx('rv-card rv-card--queue', selected && 'rv-card--selected')}
      ref={anchorRef(anchors, anchorId.queue(q.name))}
    >
      <header className="rv-card__head">
        <button type="button" className="rv-card__name rv-link" onClick={onSelect}>
          {q.name}
        </button>
        <span className="rv-counts">
          <Term definition={s.readyHint}>{`${s.ready} ${q.ready.length}`}</Term>
          <Term definition={s.unackedHint}>{`${s.unacked} ${q.unacked}`}</Term>
        </span>
      </header>
      <QueueTags args={q.args} t={t} />
      {/* Newest on the left, the head (next out) on the right, next to the consumers. */}
      <ol className="rv-strip" aria-label={s.readyHint}>
        {hidden > 0 && <li className="rv-strip__more">{format(s.more, { n: hidden })}</li>}
        {[...shown].reverse().map((m) => {
          const left = ttl !== null ? Math.max(0, 1 - (b.now - m.enqueuedAt) / ttl) : 1;
          return (
            <li
              key={`${m.id}-${m.enqueuedAt}`}
              className={cx('rv-cell', m.redelivered && 'rv-cell--again')}
              style={{ '--rv-key': keyColor(m.routingKey), '--rv-life': left } as CSSProperties}
              title={format(s.message, {
                body: m.body,
                key: m.routingKey || '""',
                redelivered: m.redelivered ? s.redeliveredMark : '',
              })}
            />
          );
        })}
        {q.ready.length === 0 && <li className="rv-strip__empty lab-muted">{s.empty}</li>}
      </ol>
      {a.maxLength !== null && (
        <div className="rv-meter" aria-hidden="true">
          <span
            style={{
              width: `${Math.min(100, (q.ready.length / Math.max(1, a.maxLength)) * 100)}%`,
            }}
          />
        </div>
      )}
      <p className="rv-card__stats">{format(s.stats, q.stats)}</p>
      <div className="rv-card__actions">
        <Button size="sm" variant="ghost" onClick={onSelect}>
          {s.inspect}
        </Button>
        <LabAction
          size="sm"
          variant="ghost"
          onClick={() => b.purgeQueue(q.name)}
          disabled={!q.ready.length}
        >
          {s.purge}
        </LabAction>
      </div>
    </article>
  );
}

/** A queue's arguments as short tags (quorum, TTL, max length, DLX…); also used for a real broker. */
export function QueueTags({ args: a, t }: { args: QueueArgs; t: RabbitStrings }) {
  const s = t.queue;
  const tags: string[] = [];
  if (a.type === 'quorum') tags.push(s.quorum);
  if (a.messageTtl !== null) tags.push(format(s.ttl, { s: a.messageTtl / 1000 }));
  if (a.maxLength !== null)
    tags.push(
      `${format(s.maxLength, { n: a.maxLength })}, ${a.overflow === 'reject-publish' ? s.overflowReject : s.overflowDrop}`,
    );
  if (a.deadLetterExchange !== null)
    tags.push(format(s.dlx, { name: a.deadLetterExchange || t.exchange.default }));
  if (a.deliveryLimit !== null) tags.push(format(s.deliveryLimit, { n: a.deliveryLimit }));
  if (a.singleActiveConsumer) tags.push(s.sac);
  if (!tags.length) return null;
  return (
    <p className="rv-tags">
      {tags.map((tag) => (
        <span key={tag} className="rv-tag">
          {tag}
        </span>
      ))}
    </p>
  );
}

/** One box of a consumer's prefetch window. */
function slotState(d: Delivery, now: number): 'wire' | 'waiting' | 'working' {
  if (d.arrivesAt > now) return 'wire';
  return d.doneAt === null ? 'waiting' : 'working';
}

function ConsumerCard({
  broker: b,
  consumer: c,
  anchors,
}: {
  broker: Broker;
  consumer: Consumer;
  anchors: AnchorRegistry;
}) {
  const t = useRabbitStrings();
  const s = t.consumer;
  const settling = b.settlingFrom(c.tag);
  const working = c.deliveries.find((d) => d.doneAt !== null && d.arrivesAt <= b.now);
  const status = c.down ? s.down : c.paused ? s.paused : working ? s.working : s.idle;
  const slots =
    c.autoAck || c.prefetch === 0 ? Math.max(c.deliveries.length + settling, 1) : c.prefetch;
  const progress =
    working && working.doneAt !== null ? 1 - (working.doneAt - b.now) / Math.max(1, c.workMs) : 0;
  return (
    <article
      className={cx(
        'rv-card rv-card--consumer',
        c.down && 'rv-card--down',
        c.paused && 'rv-card--off',
      )}
      ref={anchorRef(anchors, anchorId.consumer(c.tag))}
    >
      <header className="rv-card__head">
        <b className="rv-card__name">{c.tag}</b>
        <span className={cx('rv-status', c.down && 'rv-status--bad')}>{status}</span>
      </header>
      <p className="rv-card__line lab-muted">{format(s.on, { queue: c.queue })}</p>
      <p className="rv-tags">
        <span className="rv-tag">
          {c.prefetch > 0 && !c.autoAck ? format(s.prefetch, { n: c.prefetch }) : s.prefetchNone}
        </span>
        {c.autoAck && <span className="rv-tag rv-tag--warn">{s.autoAck}</span>}
        <span className="rv-tag">{format(s.work, { ms: c.workMs })}</span>
        {c.failEvery > 0 && (
          <span className="rv-tag rv-tag--warn">
            {format(s.fails, { n: c.failEvery, action: s.actions[c.onFail] })}
          </span>
        )}
      </p>
      {!c.down && (
        <ol className="rv-window" aria-label={s.window} title={s.window}>
          {Array.from({ length: Math.min(slots, 12) }, (_, i) => {
            const d = c.deliveries[i];
            const settlingSlot = !d && i < c.deliveries.length + settling;
            const state = d ? slotState(d, b.now) : settlingSlot ? 'settling' : 'free';
            const label =
              state === 'wire'
                ? s.slotWire
                : state === 'waiting'
                  ? s.slotWaiting
                  : state === 'working'
                    ? s.slotWorking
                    : state === 'settling'
                      ? s.slotSettling
                      : '';
            return (
              <li
                key={i}
                className={`rv-slot rv-slot--${state}`}
                title={d ? `${label}: ${d.message.body}` : label || undefined}
                style={
                  d ? ({ '--rv-key': keyColor(d.message.routingKey) } as CSSProperties) : undefined
                }
              >
                {state === 'working' && (
                  <span
                    className="rv-slot__progress"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="rv-card__stats">{format(s.stats, c.stats)}</p>
      <div className="rv-card__actions">
        {c.down ? (
          <LabAction size="sm" variant="secondary" onClick={() => b.restartConsumer(c.tag)}>
            {s.restart}
          </LabAction>
        ) : (
          <>
            <LabAction
              size="sm"
              variant="ghost"
              onClick={() => b.updateConsumer(c.tag, { paused: !c.paused })}
            >
              {c.paused ? s.resume : s.pause}
            </LabAction>
            <LabAction size="sm" variant="ghost" onClick={() => b.crashConsumer(c.tag)}>
              {s.crash}
            </LabAction>
          </>
        )}
        <LabAction size="sm" variant="ghost" onClick={() => b.removeConsumer(c.tag)}>
          {s.remove}
        </LabAction>
      </div>
    </article>
  );
}
