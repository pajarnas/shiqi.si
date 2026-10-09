import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cx } from '../cx';
import type { PolymorphicProps } from '../polymorphic';

type Space = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const gapVar = (gap?: Space) =>
  gap ? ({ '--gap': `var(--space-${gap})` } as CSSProperties) : undefined;

export function Container<E extends ElementType = 'div'>({
  as,
  className,
  ...rest
}: PolymorphicProps<E>) {
  const Tag: ElementType = as ?? 'div';
  return <Tag className={cx('ui-container', className)} {...rest} />;
}

/** Vertical flow with a consistent gap. */
export function Stack<E extends ElementType = 'div'>({
  as,
  gap,
  className,
  style,
  ...rest
}: PolymorphicProps<E, { gap?: Space }>) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag className={cx('ui-stack', className)} style={{ ...gapVar(gap), ...style }} {...rest} />
  );
}

/** Horizontal, wrapping row. */
export function Cluster<E extends ElementType = 'div'>({
  as,
  gap,
  className,
  style,
  ...rest
}: PolymorphicProps<E, { gap?: Space }>) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag className={cx('ui-cluster', className)} style={{ ...gapVar(gap), ...style }} {...rest} />
  );
}

/** Responsive grid: as many columns of at least `min` as fit. */
export function Grid({
  min = '13.5rem',
  gap,
  className,
  children,
}: {
  min?: string;
  gap?: Space;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx('ui-grid', className)}
      style={{ '--min': min, ...gapVar(gap) } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="ui-visually-hidden">{children}</span>;
}
