// "1984" desktop: a soft gradient with tone-on-tone pixel icons on a tilted
// grid. The grid drifts slowly, and now and then an icon redraws itself row
// by row, as if someone were sketching it again. Icons are our own set.

import { ICONS, PATTERN_ICONS, type Icon } from './icons';
import { rng } from './random';
import type { Ctx } from './raster';

export interface PatternColors {
  /** Gradient start (top-left) and end (bottom-right). */
  from: string;
  to: string;
  /** Icon colour: a darker, translucent tone of the background. */
  ink: string;
}

export interface PatternFocus {
  x: number;
  y: number;
  radius: number;
  /** Ink and fill for icons inside the spotlight. */
  pop: string;
  fill: string;
}

export interface PatternOptions extends PatternColors {
  w: number;
  h: number;
  seed: number;
  /** Size of one icon pixel in canvas pixels. */
  cell: number;
  /** Tilt in degrees. Default -12. */
  tilt?: number;
  /** Share of grid slots that hold an icon, 0-1. Default 0.62. */
  density?: number;
  /** Animation clock in seconds. 0 draws a still. */
  t?: number;
  /** Drift speed in icon pixels per second. Default 1.5. */
  drift?: number;
  focus?: PatternFocus | null;
}

/** Grid pitch in icon pixels: 16px icons plus breathing room. */
const PITCH = 24;
/** How long one redraw takes, in seconds. */
const SKETCH = 1.4;

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Render an icon once per colour pair into a 1:1 sprite. */
function sprite(ic: Icon, ink: string, fill: string | null): HTMLCanvasElement {
  const key = `${ic.name}|${ink}|${fill ?? ''}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = ic.w;
  c.height = ic.h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ic.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '#' || (ch === ':' && (x + y) % 2 === 0)) ctx.fillStyle = ink;
      else if (fill && (ch === 'o' || ch === ':')) ctx.fillStyle = fill;
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  spriteCache.set(key, c);
  return c;
}

/** Stable per-slot randomness, so icons keep their identity while drifting. */
function slot(seed: number, i: number, j: number) {
  const r = rng((seed ^ Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0);
  return {
    roll: r(),
    icon: ICONS[PATTERN_ICONS[Math.floor(r() * PATTERN_ICONS.length)] ?? 'heart'],
    jx: (r() - 0.5) * 0.35,
    jy: (r() - 0.5) * 0.35,
    period: 9 + r() * 22,
    phase: r() * 40,
  };
}

export function drawPattern(ctx: Ctx, o: PatternOptions): void {
  const { w, h, cell } = o;
  const t = o.t ?? 0;
  const tilt = ((o.tilt ?? -12) * Math.PI) / 180;
  const density = o.density ?? 0.62;
  const step = cell * PITCH;
  const shift = t * (o.drift ?? 1.5) * cell;

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, o.from);
  g.addColorStop(1, o.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(tilt);

  const half = Math.hypot(w, h) / 2 + step;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const i0 = Math.floor((-half - shift) / step);
  const i1 = Math.ceil((half - shift) / step);
  const j0 = Math.floor((-half - shift * 0.5) / step);
  const j1 = Math.ceil((half - shift * 0.5) / step);

  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const s = slot(o.seed, i, j);
      if (s.roll > density) continue;
      const ic = s.icon;
      const x = Math.round(i * step + shift + s.jx * step);
      const y = Math.round(j * step + shift * 0.5 + s.jy * step);

      let ink = o.ink;
      let fill: string | null = null;
      if (o.focus) {
        const cx = x + (ic.w * cell) / 2;
        const cy = y + (ic.h * cell) / 2;
        const sx = cx * cos - cy * sin + w / 2;
        const sy = cx * sin + cy * cos + h / 2;
        if (Math.hypot(sx - o.focus.x, sy - o.focus.y) < o.focus.radius) {
          ink = o.focus.pop;
          fill = o.focus.fill;
        }
      }

      // Every `period` seconds this icon sketches itself in, row by row.
      let rows = ic.h;
      if (t > 0) {
        const k = (t + s.phase) % s.period;
        if (k < SKETCH) rows = Math.max(1, Math.ceil((k / SKETCH) * ic.h));
      }
      ctx.drawImage(sprite(ic, ink, fill), 0, 0, ic.w, rows, x, y, ic.w * cell, rows * cell);
    }
  }
  ctx.restore();
}

/** Ready-made colourways for the wallpaper generator. */
export const PATTERN_THEMES = {
  gold: { from: '#f7d36a', to: '#e9a514', ink: 'rgba(92, 56, 0, 0.30)' },
  green: { from: '#8fd6a6', to: '#1f9d55', ink: 'rgba(4, 52, 26, 0.30)' },
  mint: { from: '#d3efe2', to: '#9fd7c2', ink: 'rgba(13, 92, 53, 0.28)' },
  paper: { from: '#ffffff', to: '#e9e4d6', ink: 'rgba(18, 18, 18, 0.18)' },
  ink: { from: '#2a2a28', to: '#0b0b0b', ink: 'rgba(242, 181, 27, 0.22)' },
  forest: { from: '#14402b', to: '#08130f', ink: 'rgba(191, 230, 200, 0.16)' },
} as const satisfies Record<string, PatternColors>;

export type PatternTheme = keyof typeof PATTERN_THEMES;
