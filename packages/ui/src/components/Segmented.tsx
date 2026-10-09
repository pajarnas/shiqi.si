import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedProps<T extends string> {
  /** Accessible name for the group. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Single choice between a few options. Radio-group semantics with arrow-key navigation. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + delta + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[options.indexOf(next)]?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className={cx('ui-segmented', className)}
      onKeyDown={onKeyDown}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SwatchesProps {
  label: string;
  /** `css` overrides the swatch background (a gradient, say); defaults to `value`. */
  colors: readonly { value: string; name: string; css?: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** Colour picker from a fixed palette. */
export function Swatches({ label, colors, value, onChange }: SwatchesProps) {
  return (
    <div role="radiogroup" aria-label={label} className="ui-swatches">
      {colors.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={c.value === value}
          aria-label={c.name}
          title={c.name}
          className="ui-swatch"
          style={{ background: c.css ?? c.value }}
          onClick={() => onChange(c.value)}
        />
      ))}
    </div>
  );
}
