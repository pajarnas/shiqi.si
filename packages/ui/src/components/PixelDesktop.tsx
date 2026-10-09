import { drawPattern } from '@shiqi/pixel';
import { useCallback, useEffect, useRef } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useThemeTokens } from '../theme/ThemeProvider';
import { PixelCanvas, type DrawFrame } from './PixelCanvas';

const TOKENS = [
  'pattern-from',
  'pattern-to',
  'pattern-ink',
  'pattern-pop',
  'pattern-fill',
] as const;

export interface PixelDesktopProps {
  seed?: number;
  density?: number;
  /** Size of one icon pixel in CSS pixels. Default 3 (2 on small screens). */
  pixel?: number;
}

/**
 * The animated "1984" wallpaper, fixed behind the page. Colours come from the
 * active theme. Icons near the pointer light up.
 */
export function PixelDesktop({ seed = 1984, density = 0.6, pixel }: PixelDesktopProps) {
  const tokens = useThemeTokens(TOKENS);
  const small = useMediaQuery('(max-width: 40rem)');
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') pointer.current = { x: e.clientX, y: e.clientY };
    };
    const leave = () => {
      pointer.current = null;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, []);

  const draw = useCallback(
    ({ ctx, w, h, scale, t }: DrawFrame) => {
      if (!tokens) return;
      const p = pointer.current;
      drawPattern(ctx, {
        w,
        h,
        seed,
        density,
        t,
        cell: Math.max(1, Math.round((pixel ?? (small ? 2 : 3)) * scale)),
        from: tokens['pattern-from'],
        to: tokens['pattern-to'],
        ink: tokens['pattern-ink'],
        focus: p
          ? {
              x: p.x * scale,
              y: p.y * scale,
              radius: 90 * scale,
              pop: tokens['pattern-pop'],
              fill: tokens['pattern-fill'],
            }
          : null,
      });
    },
    [tokens, seed, density, pixel, small],
  );

  return <PixelCanvas className="ui-desktop" draw={draw} resolution="device" animate fps={24} />;
}
