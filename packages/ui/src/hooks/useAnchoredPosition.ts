import { useLayoutEffect, useState, type RefObject } from 'react';

export interface AnchoredPosition {
  top: number;
  left: number;
  /** Where the floating box ended up relative to its anchor. */
  side: 'above' | 'below';
}

/** Gap kept between the floating box and the viewport edge, in pixels. */
const EDGE = 8;
/** Gap between the anchor and the floating box, in pixels. */
const GAP = 8;

/**
 * Viewport coordinates for a fixed-position box tied to an anchor: centred on
 * it, above when there is room and below when not, and slid sideways so it
 * never leaves the screen. Follows the anchor on scroll and resize.
 */
export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  open: boolean,
): AnchoredPosition | null {
  const [pos, setPos] = useState<AnchoredPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current;
      const f = floating.current;
      if (!a || !f) return;
      setPos(placeBox(a.getBoundingClientRect(), f.getBoundingClientRect(), viewport()));
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, floating, open]);

  return open ? pos : null;
}

const viewport = () => ({
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
});

type Rect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width' | 'height'>;

/** The pure placement rule, kept apart from the DOM so it can be tested. */
export function placeBox(
  anchor: Rect,
  box: Pick<Rect, 'width' | 'height'>,
  view: { width: number; height: number },
): AnchoredPosition {
  const roomAbove = anchor.top - GAP - EDGE;
  const roomBelow = view.height - anchor.bottom - GAP - EDGE;
  const side = box.height <= roomAbove || roomAbove >= roomBelow ? 'above' : 'below';
  const top = side === 'above' ? anchor.top - GAP - box.height : anchor.bottom + GAP;
  const centred = anchor.left + anchor.width / 2 - box.width / 2;
  const left = Math.max(EDGE, Math.min(centred, view.width - EDGE - box.width));
  return { top: Math.max(EDGE, top), left, side };
}
