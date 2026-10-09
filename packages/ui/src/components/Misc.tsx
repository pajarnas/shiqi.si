import type { ReactNode } from 'react';
import { cx } from '../cx';

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export function Badge({
  tone = 'gold',
  children,
}: {
  tone?: 'gold' | 'green';
  children: ReactNode;
}) {
  return <span className={cx('ui-badge', tone === 'green' && 'ui-badge--green')}>{children}</span>;
}

export function Callout({ children }: { children: ReactNode }) {
  return <aside className="ui-callout">{children}</aside>;
}
