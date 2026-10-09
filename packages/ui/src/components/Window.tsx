import type { ReactNode } from 'react';
import { cx } from '../cx';

export interface WindowProps {
  /** Text in the striped title bar. */
  title: ReactNode;
  /** Optional slot at the right end of the title bar. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A classic desktop window: striped title bar, square close box, solid body. */
export function Window({ title, actions, className, children }: WindowProps) {
  return (
    <div className={cx('ui-window', className)}>
      <div className="ui-window__bar">
        <span className="ui-window__box" aria-hidden="true" />
        <span className="ui-window__title">{title}</span>
        {actions ? (
          <span className="ui-window__actions">{actions}</span>
        ) : (
          <span className="ui-window__box ui-window__box--ghost" aria-hidden="true" />
        )}
      </div>
      <div className="ui-window__body">{children}</div>
    </div>
  );
}
