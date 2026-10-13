// The real broker, read live from /api/rabbitmq/snapshot: exchanges with
// their bindings and queues with their depth and rates, drawn with the same
// cards as the simulation so the two are easy to compare.
import { QueueTags } from '@shiqi/rabbitmq-viz';
import { Section, Term, cx } from '@shiqi/ui';
import { format, useI18n } from '~/i18n';
import { usePolled } from '~/lib/usePolled';
import type { RabbitExchange, RabbitQueue, RabbitSnapshot } from './snapshot';

const MB = 1024 * 1024;
/** Rates as the broker reports them, to one decimal. */
const r = (n: number) => (Math.round(n * 10) / 10).toString();

export function RealBroker() {
  const { t, locale } = useI18n();
  const s = t.rabbitmq.real;
  const state = usePolled<RabbitSnapshot>('/api/rabbitmq/snapshot');

  if (state.kind === 'loading') return <p className="lab-muted">{s.loading}</p>;
  if (state.kind === 'unavailable') return <p className="lab-muted">{s.unavailable}</p>;
  if (state.kind === 'error')
    return <p className="lab-muted">{format(s.error, { status: state.status })}</p>;

  const snap = state.data;
  const { node } = snap;
  return (
    <div className="lab-app rr">
      <p className="real-status">
        {format(s.readAt, { time: new Date(snap.at).toLocaleTimeString(locale) })}
        <span className="rv-tag">{format(s.version, { version: snap.version })}</span>
        <Term className="rv-tag" definition={s.memoryHint}>
          {format(s.memory, {
            used: Math.round(node.memUsed / MB),
            limit: Math.round(node.memLimit / MB),
          })}
        </Term>
        {node.alarm && <span className="rv-tag rv-tag--warn">{s.alarm}</span>}
        <span className="rv-tag">{format(s.connections, { n: snap.connections })}</span>
      </p>

      <Section eyebrow="EXCHANGES" title={s.exchanges}>
        {snap.exchanges.length === 0 ? (
          <p className="lab-muted">{s.noExchanges}</p>
        ) : (
          <div className="rr-grid">
            {snap.exchanges.map((x) => (
              <ExchangeCard key={x.name} exchange={x} snapshot={snap} />
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="QUEUES" title={s.queues}>
        {snap.queues.length === 0 ? (
          <p className="lab-muted">{s.noQueues}</p>
        ) : (
          <div className="rr-grid">
            {snap.queues.map((q) => (
              <QueueCard key={q.name} queue={q} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ExchangeCard({
  exchange: x,
  snapshot,
}: {
  exchange: RabbitExchange;
  snapshot: RabbitSnapshot;
}) {
  const { t } = useI18n();
  const s = t.rabbitmq.real;
  const types: Record<string, string> = t.rabbitmq.lab.exchange.types;
  const bindings = snapshot.bindings.filter((b) => b.source === x.name);
  return (
    <article className="rv-card rv-card--exchange">
      <header className="rv-card__head">
        <b className="rv-card__name">{x.name}</b>
        <Term className="rv-tag rv-tag--type" definition={types[x.type] ?? x.type}>
          {x.type}
        </Term>
      </header>
      <p className="rv-card__stats">
        {format(s.exchangeRates, { in: r(x.rates.in), out: r(x.rates.out) })}
      </p>
      {bindings.length === 0 ? (
        <p className="rv-card__stats">{s.noBindings}</p>
      ) : (
        <ul className="rr-bindings">
          {bindings.map((b) => (
            <li key={`${b.destination}|${b.routingKey}`}>
              {format(s.binding, { destination: b.destination })}{' '}
              {b.routingKey && (
                <span className="rv-tag">{format(s.bindingKey, { key: b.routingKey })}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function QueueCard({ queue: q }: { queue: RabbitQueue }) {
  const { t } = useI18n();
  const s = t.rabbitmq.real;
  const qs = t.rabbitmq.lab.queue;
  const max = q.args.maxLength;
  return (
    <article className={cx('rv-card rv-card--queue', q.state !== 'running' && 'rv-card--down')}>
      <header className="rv-card__head">
        <b className="rv-card__name">{q.name}</b>
        <span className="rv-counts">
          <Term definition={qs.readyHint}>{`${qs.ready} ${q.ready}`}</Term>
          <Term definition={qs.unackedHint}>{`${qs.unacked} ${q.unacked}`}</Term>
        </span>
      </header>
      <QueueTags args={q.args} t={t.rabbitmq.lab} />
      {max !== null && (
        <div className="rv-meter" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (q.ready / Math.max(1, max)) * 100)}%` }} />
        </div>
      )}
      <p className="rv-card__stats">{format(s.consumers, { n: q.consumers })}</p>
      <p className="rv-card__stats">
        {format(s.queueRates, {
          publish: r(q.rates.publish),
          deliver: r(q.rates.deliver),
          ack: r(q.rates.ack),
          redeliver: r(q.rates.redeliver),
        })}
      </p>
    </article>
  );
}
