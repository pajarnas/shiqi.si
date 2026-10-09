// Doodle wall: split a canvas into panels, then fill every panel with a
// little drawing. The Sam Cox rule is "leave no space empty"; the pixel rule
// is "every pixel is a decision". This tries to keep both.

import { drawCritter } from './critter';
import { PALETTE as P } from './palette';
import { rng, type Random } from './random';
import { circle, line, type Ctx } from './raster';

export interface DoodleCell {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: string;
  motif: MotifName;
  seed: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Motif {
  min?: number;
  draw(ctx: Ctx, b: Box, r: Random, fill: string, bg: string): void;
}

const MIN = 10;

/** Split the canvas into panels and assign each a background and motif. */
export function layoutDoodle(seed: number, w: number, h: number): DoodleCell[] {
  const r = rng(seed);
  const boxes: Box[] = [];
  const split = (x: number, y: number, cw: number, ch: number, depth: number): void => {
    const canW = cw >= MIN * 2;
    const canH = ch >= MIN * 2;
    const small = cw <= 28 && ch <= 28;
    if ((!canW && !canH) || (depth > 1 && small && r() < 0.45)) {
      boxes.push({ x, y, w: cw, h: ch });
      return;
    }
    const vertical = canW && (!canH || cw > ch * 1.2 || (cw >= ch / 1.2 && r() < 0.5));
    const size = vertical ? cw : ch;
    const at = Math.round(MIN + r() * (size - MIN * 2));
    if (vertical) {
      split(x, y, at, ch, depth + 1);
      split(x + at, y, cw - at, ch, depth + 1);
    } else {
      split(x, y, cw, at, depth + 1);
      split(x, y + at, cw, ch - at, depth + 1);
    }
  };
  split(0, 0, w, h, 0);

  const motifs = Object.keys(MOTIFS) as MotifName[];
  return boxes.map((b) => {
    const roll = r();
    const bg = roll < 0.13 ? P.gold : roll < 0.22 ? P.greenPale : roll < 0.28 ? P.green : P.paper;
    const fits = motifs.filter((m) => Math.min(b.w, b.h) >= ((MOTIFS[m] as Motif).min ?? 0));
    const motif = fits[Math.floor(r() * fits.length)] ?? 'dots';
    return { ...b, bg, motif, seed: Math.floor(r() * 2 ** 31) };
  });
}

/** Draw one panel: background, rounded ink frame, then its motif. */
export function drawCell(ctx: Ctx, c: DoodleCell): void {
  const { x, y, w, h, bg } = c;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.ink;
  // Frame with clipped corners, so panels read as hand-drawn boxes.
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  const box = { x: x + 3, y: y + 3, w: w - 6, h: h - 6 };
  const fill = bg === P.paper ? P.gold : P.paper;
  (MOTIFS[c.motif] as Motif).draw(ctx, box, rng(c.seed), fill, bg);
}

const center = (b: Box): [number, number, number] => [
  b.x + Math.floor(b.w / 2),
  b.y + Math.floor(b.h / 2),
  Math.min(b.w, b.h),
];

const MOTIFS = {
  face: {
    min: 9,
    draw(ctx, b, r, fill) {
      const [cx, cy, s] = center(b);
      const rad = Math.floor(s / 2);
      ctx.fillStyle = r() < 0.5 ? fill : P.paper;
      circle(ctx, cx, cy, rad, true);
      ctx.fillStyle = P.ink;
      circle(ctx, cx, cy, rad);
      const ex = Math.max(1, Math.round(rad * 0.4));
      const ey = cy - Math.round(rad * 0.3);
      const big = rad > 6 ? 2 : 1;
      ctx.fillRect(cx - ex, ey, big, big);
      ctx.fillRect(cx + ex - big + 1, ey, big, big);
      const my = cy + Math.round(rad * 0.3);
      const mw = Math.max(1, Math.round(rad * 0.45));
      line(ctx, cx - mw, my, cx, my + Math.max(1, Math.round(rad * 0.25)));
      line(ctx, cx, my + Math.max(1, Math.round(rad * 0.25)), cx + mw, my);
    },
  },
  eye: {
    min: 9,
    draw(ctx, b, r, fill) {
      const [cx, cy] = center(b);
      const a = Math.floor(b.w / 2);
      const bh = Math.max(2, Math.floor(Math.min(b.h / 2, a * 0.6)));
      ctx.fillStyle = P.paper;
      for (let dx = -a; dx <= a; dx++) {
        const hgt = Math.round(bh * (1 - (dx / a) ** 2));
        ctx.fillRect(cx + dx, cy - hgt, 1, hgt * 2 + 1);
      }
      ctx.fillStyle = fill === P.paper ? P.green : fill;
      circle(ctx, cx, cy, Math.max(1, Math.round(bh * 0.75)), true);
      ctx.fillStyle = P.ink;
      circle(ctx, cx, cy, Math.max(1, Math.round(bh * 0.4)), true);
      for (let dx = -a; dx <= a; dx++) {
        const hgt = Math.round(bh * (1 - (dx / a) ** 2));
        ctx.fillRect(cx + dx, cy - hgt, 1, 1);
        ctx.fillRect(cx + dx, cy + hgt, 1, 1);
      }
      ctx.fillStyle = P.paper;
      ctx.fillRect(cx - 1, cy - 1, 1, 1);
    },
  },
  waves: {
    draw(ctx, b, r) {
      const phase = r() * 6;
      ctx.fillStyle = P.ink;
      for (let y = b.y + 1; y < b.y + b.h - 1; y += 4) {
        let py = y;
        for (let x = b.x; x < b.x + b.w; x++) {
          const ny = y + Math.round(Math.sin(x * 0.7 + phase));
          line(ctx, x - 1, py, x, ny);
          py = ny;
        }
      }
    },
  },
  zigzag: {
    draw(ctx, b) {
      ctx.fillStyle = P.ink;
      for (let y = b.y + 1; y < b.y + b.h - 1; y += 4) {
        for (let x = b.x; x < b.x + b.w; x++) {
          const k = (x - b.x) % 4;
          ctx.fillRect(x, y + (k < 2 ? k : 4 - k), 1, 1);
        }
      }
    },
  },
  dots: {
    draw(ctx, b, r, fill) {
      const big = r() < 0.5;
      for (let y = b.y; y < b.y + b.h; y += 3) {
        const off = ((y - b.y) / 3) % 2 ? 1 : 0;
        for (let x = b.x + off; x < b.x + b.w; x += 3) {
          ctx.fillStyle = big && r() < 0.15 ? fill : P.ink;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
  },
  spiral: {
    min: 7,
    draw(ctx, b) {
      // Square spiral: walk right, down, left, up, shrinking by 2 each turn.
      ctx.fillStyle = P.ink;
      let x = b.x;
      let y = b.y;
      let w = b.w - 1;
      let h = b.h - 1;
      line(ctx, x, y, x + w, y);
      x += w;
      for (let turn = 0; w > 0 && h > 0; turn++) {
        const dir = turn % 4;
        if (dir === 0) {
          line(ctx, x, y, x, y + h);
          y += h;
          w -= 2;
        } else if (dir === 1) {
          line(ctx, x, y, x - w, y);
          x -= w;
          h -= 2;
        } else if (dir === 2) {
          line(ctx, x, y, x, y - h);
          y -= h;
          w -= 2;
        } else {
          line(ctx, x, y, x + w, y);
          x += w;
          h -= 2;
        }
      }
    },
  },
  sun: {
    min: 9,
    draw(ctx, b, r, fill) {
      const [cx, cy, s] = center(b);
      const rad = Math.max(2, Math.floor(s / 4));
      ctx.fillStyle = P.ink;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        line(
          ctx,
          cx + Math.round(Math.cos(a) * (rad + 2)),
          cy + Math.round(Math.sin(a) * (rad + 2)),
          cx + Math.round(Math.cos(a) * (s / 2)),
          cy + Math.round(Math.sin(a) * (s / 2)),
        );
      }
      ctx.fillStyle = fill === P.paper ? P.gold : fill;
      circle(ctx, cx, cy, rad, true);
      ctx.fillStyle = P.ink;
      circle(ctx, cx, cy, rad);
    },
  },
  stripes: {
    draw(ctx, b, r) {
      const dir = r() < 0.5 ? 1 : -1;
      ctx.fillStyle = P.ink;
      for (let y = b.y; y < b.y + b.h; y++) {
        for (let x = b.x; x < b.x + b.w; x++) {
          if ((((x + dir * y) % 4) + 4) % 4 === 0) ctx.fillRect(x, y, 1, 1);
        }
      }
    },
  },
  house: {
    min: 10,
    draw(ctx, b, r, fill) {
      const [cx, , s] = center(b);
      const half = Math.floor(s / 2) - 1;
      const base = b.y + b.h - 1;
      const wallTop = base - Math.floor(s * 0.55);
      ctx.fillStyle = P.paper;
      ctx.fillRect(cx - half, wallTop, half * 2 + 1, base - wallTop);
      ctx.fillStyle = fill === P.paper ? P.green : fill;
      for (let i = 0; i <= half; i++) ctx.fillRect(cx - i, wallTop - half + i, i * 2 + 1, 1);
      ctx.fillStyle = P.ink;
      line(ctx, cx - half, wallTop, cx, wallTop - half);
      line(ctx, cx, wallTop - half, cx + half, wallTop);
      line(ctx, cx - half, wallTop, cx + half, wallTop);
      line(ctx, cx - half, wallTop, cx - half, base);
      line(ctx, cx + half, wallTop, cx + half, base);
      line(ctx, cx - half, base, cx + half, base);
      ctx.fillRect(cx - 1, base - 3, 2, 3);
      if (half > 4) ctx.fillRect(cx + 2, wallTop + 2, 2, 2);
    },
  },
  heart: {
    min: 8,
    draw(ctx, b, r, fill) {
      const [cx, cy, s] = center(b);
      const k = s / 2.6;
      const inside = (x: number, y: number) => {
        const u = (x - cx) / k;
        const v = -(y - cy) / k + 0.2;
        return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0;
      };
      for (let y = b.y; y < b.y + b.h; y++) {
        for (let x = b.x; x < b.x + b.w; x++) {
          if (!inside(x, y)) continue;
          const edge =
            !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          ctx.fillStyle = edge ? P.ink : fill === P.paper ? P.gold : fill;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
  },
  flower: {
    min: 11,
    draw(ctx, b, r, fill) {
      const [cx, cy, s] = center(b);
      const pr = Math.max(2, Math.floor(s / 5));
      const d = pr + 1;
      for (const [dx, dy] of [
        [0, -d],
        [d, 0],
        [0, d],
        [-d, 0],
      ] as const) {
        ctx.fillStyle = P.paper;
        circle(ctx, cx + dx, cy + dy, pr, true);
        ctx.fillStyle = P.ink;
        circle(ctx, cx + dx, cy + dy, pr);
      }
      ctx.fillStyle = fill === P.paper ? P.gold : fill;
      circle(ctx, cx, cy, Math.max(1, pr - 1), true);
      ctx.fillStyle = P.ink;
      circle(ctx, cx, cy, Math.max(1, pr - 1));
    },
  },
  critter: {
    min: 12,
    draw(ctx, b, r) {
      const scale = Math.max(1, Math.floor(Math.min(b.w, b.h) / 12));
      const size = 12 * scale;
      drawCritter(ctx, b.x + Math.floor((b.w - size) / 2), b.y + Math.floor((b.h - size) / 2), {
        seed: Math.floor(r() * 2 ** 31),
        scale,
      });
    },
  },
  checker: {
    draw(ctx, b, r, fill) {
      for (let y = b.y; y < b.y + b.h; y += 2) {
        for (let x = b.x; x < b.x + b.w; x += 2) {
          ctx.fillStyle = ((x - b.x + y - b.y) / 2) % 2 ? P.ink : fill;
          ctx.fillRect(x, y, Math.min(2, b.x + b.w - x), Math.min(2, b.y + b.h - y));
        }
      }
    },
  },
} satisfies Record<string, Motif>;

export type MotifName = keyof typeof MOTIFS;
