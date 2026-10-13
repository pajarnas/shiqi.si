import type { Broker } from '@shiqi/rabbitmq';
import { format } from '@shiqi/ui';
import type { CSSProperties } from 'react';
import { useRabbitStrings } from '../i18n';
import { keyColor } from '../keys';
import { QueueTags } from './Stage';

const SHOWN = 30;

/** Inside one queue: its arguments, bindings, consumers and every ready message. */
export function Inspector({ broker: b, queue: name }: { broker: Broker; queue: string | null }) {
  const t = useRabbitStrings();
  const s = t.inspect;
  const q = name ? b.queues.get(name) : undefined;
  if (!q) return <p className="lab-muted">{s.none}</p>;
  const bindings = b.bindingsTo(q.name);
  const consumers = q.consumers.map((tag) => b.consumers.get(tag)).filter((c) => c !== undefined);
  const c = s.columns;
  return (
    <div className="rv-inspector">
      <h3>{format(s.title, { name: q.name })}</h3>
      <section>
        <h4>{s.args}</h4>
        <QueueTags queue={q} t={t} />
        {q.args.type === 'classic' &&
          !q.args.messageTtl &&
          q.args.maxLength === null &&
          !q.args.deadLetterExchange && <p className="lab-muted">{s.noArgs}</p>}
      </section>
      <section>
        <h4>{s.bindings}</h4>
        {bindings.length ? (
          <ul className="rv-list">
            {bindings.map((x) => (
              <li key={`${x.source}:${x.routingKey}:${JSON.stringify(x.args)}`}>
                <b>{x.source || t.exchange.default}</b> <code>{x.routingKey || '""'}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lab-muted">{s.noBindings}</p>
        )}
      </section>
      <section>
        <h4>{s.consumers}</h4>
        {consumers.length ? (
          <ul className="rv-list">
            {consumers.map((k) => (
              <li key={k.tag}>
                <b>{k.tag}</b>{' '}
                {k.autoAck
                  ? t.consumer.autoAck
                  : k.prefetch > 0
                    ? format(t.consumer.prefetch, { n: k.prefetch })
                    : t.consumer.prefetchNone}
                {' · '}
                {`${t.queue.unacked} ${k.deliveries.length + b.settlingFrom(k.tag)}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="lab-muted">{s.noConsumers}</p>
        )}
      </section>
      <section>
        <h4>{s.messages}</h4>
        {q.ready.length === 0 ? (
          <p className="lab-muted">{s.noMessages}</p>
        ) : (
          <div className="rv-table-wrap">
            <table className="rv-table">
              <thead>
                <tr>
                  <th>{c.id}</th>
                  <th>{c.body}</th>
                  <th>{c.key}</th>
                  <th>{c.redelivered}</th>
                  <th>{c.deliveries}</th>
                  <th>{c.deaths}</th>
                  <th>{c.age}</th>
                </tr>
              </thead>
              <tbody>
                {q.ready.slice(0, SHOWN).map((m) => (
                  <tr key={`${m.id}-${m.enqueuedAt}`}>
                    <td>{m.id}</td>
                    <td>{m.body}</td>
                    <td>
                      <span
                        className="rv-key"
                        style={{ '--rv-key': keyColor(m.routingKey) } as CSSProperties}
                      >
                        {m.routingKey || '""'}
                      </span>
                    </td>
                    <td>{m.redelivered ? s.yes : s.no}</td>
                    <td>{m.deliveries}</td>
                    <td>
                      {m.deaths
                        .map((d) =>
                          format(s.death, {
                            count: d.count,
                            reason: t.events.reasons[d.reason],
                            queue: d.queue,
                          }),
                        )
                        .join('; ')}
                    </td>
                    <td>{format(s.seconds, { s: ((b.now - m.enqueuedAt) / 1000).toFixed(1) })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
