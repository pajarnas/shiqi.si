import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import { useAnchoredPosition } from '../hooks/useAnchoredPosition';

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
 * The definition floats above the page, so no card or screen edge cuts it off.
 */
export function Term({ children, definition, title, className }: TermProps) {
  const id = useId();
  const word = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hovered || focused;
  const pos = useAnchoredPosition(word, tip, open);

  const close = () => {
    setPinned(false);
    setFocused(false);
    setHovered(false);
  };

  return (
    <span
      className={cx('ui-term', open && 'ui-term--open', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={word}
        type="button"
        className="ui-term__word"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => {
          setPinned(false);
          setFocused(false);
        }}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <span
            ref={tip}
            role="tooltip"
            id={id}
            className="ui-term__tip"
            style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
          >
            {title && <b className="ui-term__title">{title}</b>}
            {definition}
          </span>,
          document.body,
        )}
    </span>
  );
}
