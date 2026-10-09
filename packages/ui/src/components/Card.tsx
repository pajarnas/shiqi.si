import type { ElementType } from 'react';
import { cx } from '../cx';
import type { PolymorphicProps } from '../polymorphic';

export interface CardStyle {
  /** Lift on hover and press on click. Use for cards that are links. */
  interactive?: boolean;
  /** Add standard inner padding. */
  padded?: boolean;
}

export function cardClass({ interactive, padded }: CardStyle = {}) {
  return cx('ui-card', interactive && 'ui-card--interactive', padded && 'ui-card--pad');
}

export function Card<E extends ElementType = 'div'>({
  as,
  interactive,
  padded,
  className,
  ...rest
}: PolymorphicProps<E, CardStyle>) {
  const Tag: ElementType = as ?? 'div';
  return <Tag className={cx(cardClass({ interactive, padded }), className)} {...rest} />;
}
