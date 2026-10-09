import type { ElementType, ReactNode } from 'react';
import { cx } from '../cx';
import type { PolymorphicProps } from '../polymorphic';

/** Grouped list, Settings-style. Put it inside a Card. */
export function List({ className, children }: { className?: string; children: ReactNode }) {
  return <ul className={cx('ui-list', className)}>{children}</ul>;
}

export interface ListItemOwnProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-hand detail: a date, a count, a chevron. */
  meta?: ReactNode;
}

/** One row. Render it `as` a link to make the whole row clickable. */
export function ListItem<E extends ElementType = 'div'>({
  as,
  icon,
  title,
  description,
  meta,
  className,
  ...rest
}: PolymorphicProps<E, ListItemOwnProps>) {
  const Tag: ElementType = as ?? 'div';
  return (
    <li>
      <Tag className={cx('ui-list__item', className)} {...rest}>
        <span aria-hidden="true">{icon}</span>
        <span>
          <span className="ui-list__title">{title}</span>
          {description && <span className="ui-list__desc">{description}</span>}
        </span>
        {meta !== undefined && <span className="ui-list__meta">{meta}</span>}
      </Tag>
    </li>
  );
}
