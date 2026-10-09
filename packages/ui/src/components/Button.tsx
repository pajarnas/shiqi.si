import type { ElementType } from 'react';
import { cx } from '../cx';
import type { PolymorphicProps } from '../polymorphic';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square button holding only an icon. Give it an `aria-label`. */
  iconOnly?: boolean;
}

/** Class names for a button, for elements that cannot be a <Button> (router links, labels). */
export function buttonClass({ variant = 'primary', size = 'md', iconOnly }: ButtonStyle = {}) {
  return cx(
    'ui-btn',
    variant !== 'primary' && `ui-btn--${variant}`,
    size === 'sm' && 'ui-btn--sm',
    iconOnly && 'ui-btn--icon',
  );
}

type ButtonProps<E extends ElementType> = PolymorphicProps<E, ButtonStyle>;

export function Button<E extends ElementType = 'button'>({
  as,
  variant,
  size,
  iconOnly,
  className,
  ...rest
}: ButtonProps<E>) {
  const Tag: ElementType = as ?? 'button';
  const extra = Tag === 'button' && !('type' in rest) ? { type: 'button' } : {};
  return (
    <Tag className={cx(buttonClass({ variant, size, iconOnly }), className)} {...extra} {...rest} />
  );
}
