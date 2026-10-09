import type { ComponentPropsWithoutRef, ElementType } from 'react';

/** Props for a component that renders as `E` (default element or a router Link, say). */
export type PolymorphicProps<E extends ElementType, P = object> = P & {
  as?: E;
} & Omit<ComponentPropsWithoutRef<E>, keyof P | 'as'>;
