import type { CSSProperties, ReactNode } from 'react';
import { useRabbitStrings } from '../i18n';

function Item({ sample, children }: { sample: ReactNode; children: ReactNode }) {
  return (
    <li className="rv-legend__item">
      <span className="rv-legend__sample" aria-hidden="true">
        {sample}
      </span>
      {children}
    </li>
  );
}

const key = (n: number) => ({ '--rv-key': `var(--rv-key-${n})` }) as CSSProperties;

/** Every mark on the stage, explained once. */
export function Legend() {
  const t = useRabbitStrings();
  const s = t.legend;
  return (
    <details className="rv-legend">
      <summary>{s.title}</summary>
      <ul>
        <Item sample={<span className="rv-mark rv-mark--square" style={key(1)} />}>
          {s.message}
        </Item>
        <Item sample={<span className="rv-mark rv-mark--dot" style={key(1)} />}>{s.delivery}</Item>
        <Item sample={<span className="rv-mark rv-mark--hollow" />}>{s.ack}</Item>
        <Item sample={<span className="rv-mark rv-mark--cross" />}>{s.bad}</Item>
        <Item sample={<span className="rv-line rv-line--binding">key</span>}>{s.binding}</Item>
        <Item sample={<span className="rv-line rv-line--consume" />}>{s.subscription}</Item>
        <Item sample={<span className="rv-line rv-line--dead">DLX</span>}>{s.deadRoute}</Item>
        <Item sample={<span className="rv-cell" style={key(2)} />}>{s.ready}</Item>
        <Item sample={<span className="rv-slot rv-slot--working" style={key(2)} />}>
          {s.unacked}
        </Item>
        <Item sample={<span className="rv-cell rv-cell--again" style={key(3)} />}>
          {s.redelivered}
        </Item>
      </ul>
    </details>
  );
}
