import { useId, useState, type ReactNode } from 'react';
import { cx } from '../cx';

export interface TermProps {
  /** The word as written in the text. */
  children: ReactNode;
  /** What it means: shown on hover, focus or tap. */
  definition: ReactNode;
  /** The full name, when the text uses an abbreviation. */
  title?: string;
  className?: string;
}

/**
 * A word with its definition one hover away, for jargon inside running text.
 * Keyboard and touch work too: focus or tap opens it, Escape closes it.
 */
export function Term({ children, definition, title, className }: TermProps) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  return (
    <span className={cx('ui-term', pinned && 'ui-term--open', className)}>
      <button
        type="button"
        className="ui-term__word"
        aria-describedby={id}
        aria-expanded={pinned}
        onClick={() => setPinned((p) => !p)}
        onBlur={() => setPinned(false)}
        onKeyDown={(e) => e.key === 'Escape' && setPinned(false)}
      >
        {children}
      </button>
      <span role="tooltip" id={id} className="ui-term__tip">
        {title && <b className="ui-term__title">{title}</b>}
        {definition}
      </span>
    </span>
  );
}
