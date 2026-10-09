import type { ReactNode } from 'react';

export interface MenuBarProps {
  /** Left: logo or site name. */
  brand: ReactNode;
  /** Middle: primary navigation links. */
  children?: ReactNode;
  /** Right: clock, theme switch. */
  end?: ReactNode;
  /** Accessible name of the navigation. */
  navLabel?: string;
}

/** A thin top bar in the spirit of an old desktop menu bar. */
export function MenuBar({ brand, children, end, navLabel = '主导航' }: MenuBarProps) {
  return (
    <header className="ui-menubar">
      <div className="ui-menubar__inner">
        <div className="ui-menubar__brand">{brand}</div>
        {children && (
          <nav aria-label={navLabel} className="ui-menubar__nav">
            {children}
          </nav>
        )}
        {end && <div className="ui-menubar__end">{end}</div>}
      </div>
    </header>
  );
}
