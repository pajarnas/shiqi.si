// The living landscape: a dithered sky that follows the clock, rolling hills
// with ink outlines, and a few small things that move.

import { drawCritter } from './critter';
import { PALETTE as P, hexToRgb } from './palette';
import { rng } from './random';
import { circle, dither, type Ctx } from './raster';

/** Sky stops (top, middle, bottom) per time of day. Hours are local, 0-24. */
export type SkyId =
  'lateNight' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'nightfall' | 'night';

export interface Sky {
  from: number;
  /** Stable id; apps map it to a display name in their own language. */
  id: SkyId;
  stops: readonly [string, string, string];
  night: boolean;
}

const SKIES: readonly Sky[] = [
  { from: 0, id: 'lateNight', stops: ['#08130f', '#0e1f1a', '#1d3b30'], night: true },
  { from: 5, id: 'dawn', stops: ['#1d3b30', '#6fae95', '#fbe7a6'], night: false },
  { from: 7, id: 'morning', stops: ['#9fd7c2', '#d6eedf', '#fbf8ef'], night: false },
  { from: 11, id: 'noon', stops: ['#7cc8ad', '#bfe6c8', '#fbf8ef'], night: false },
  { from: 16, id: 'afternoon', stops: ['#9fd7c2', '#fbe7a6', '#f2b51b'], night: false },
  { from: 18, id: 'dusk', stops: ['#0d5c35', '#c98a0c', '#f2b51b'], night: false },
  { from: 19.5, id: 'nightfall', stops: ['#0e1f1a', '#1d3b30', '#0d5c35'], night: true },
  { from: 21, id: 'night', stops: ['#08130f', '#0e1f1a', '#1d3b30'], night: true },
];

/** Hill colours, back to front, for day and night. */
const HILLS_DAY = ['#bfe6c8', '#5fbf7f', '#1f9d55', '#0d5c35'];
const HILLS_NIGHT = ['#1d3b30', '#16402b', '#0f3322', '#0a2418'];

export function skyFor(hour: number): Sky {
  let sky = SKIES[0] as Sky;
  for (const s of SKIES) if (hour >= s.from) sky = s;
  return sky;
}

function paintSky(ctx: Ctx, w: number, h: number, stops: readonly string[]) {
  const img = ctx.createImageData(w, h);
  const rgb = stops.map(hexToRgb);
  for (let y = 0; y < h; y++) {
    // Map the row onto two segments: stop 0 -> 1, then stop 1 -> 2.
    const v = (y / Math.max(1, h - 1)) * 2;
    const seg = v < 1 ? 0 : 1;
    const t = v - seg;
    for (let x = 0; x < w; x++) {
      const c = (dither(x, y, t) ? rgb[seg + 1] : rgb[seg]) as [number, number, number];
      const i = (y * w + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

interface Layer {
  base: number;
  waves: [number, number, number][];
}

/** Height of a hill layer at column x, as a y coordinate. */
function hillY(layer: Layer, x: number, w: number, h: number) {
  const u = x / w;
  let y = layer.base;
  for (const [amp, freq, phase] of layer.waves) y += amp * Math.sin(u * freq + phase);
  return Math.round(y * h);
}

function makeLayers(seed: number): Layer[] {
  const r = rng(seed);
  const bases = [0.6, 0.68, 0.77, 0.87];
  return bases.map((base, k) => ({
    base,
    waves: [
      [0.05 - k * 0.006, 3 + r() * 3, r() * 6.28],
      [0.025, 7 + r() * 5, r() * 6.28],
      [0.008, 19 + r() * 10, r() * 6.28],
    ],
  }));
}

export interface SceneOptions {
  w: number;
  h: number;
  seed: number;
  /** Local time in fractional hours, 0-24. */
  hour: number;
  /** Animation clock in seconds. */
  t?: number;
  /** Walk a critter along the front ridge. */
  critter?: boolean;
}

/** Draw one frame of the landscape and return the sky it used. */
export function drawScene(ctx: Ctx, o: SceneOptions): Sky {
  const { w, h, seed, hour } = o;
  const t = o.t ?? 0;
  const r = rng(seed);
  const sky = skyFor(hour);
  const unit = Math.min(w, h);

  paintSky(ctx, w, h, sky.stops);

  // Stars, twinkling at night only.
  if (sky.night) {
    const rs = rng(seed ^ 0x5eed);
    const count = Math.round((w * h) / 140);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rs() * w);
      const y = Math.floor(rs() * h * 0.6);
      const phase = rs() * 10;
      if (Math.sin(t * 1.5 + phase) > -0.3) {
        ctx.fillStyle = rs() < 0.2 ? P.gold : P.paper;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Sun by day, moon by night, travelling along a shallow arc.
  const dayT = (hour - 6) / 13; // 06:00 -> 19:00
  const nightT = ((hour + 24 - 19) % 24) / 11; // 19:00 -> 06:00
  const arcT = sky.night ? nightT : dayT;
  const bx = Math.round(w * (0.1 + 0.8 * Math.min(1, Math.max(0, arcT))));
  const by = Math.round(h * (0.62 - 0.45 * Math.sin(Math.PI * Math.min(1, Math.max(0, arcT)))));
  const br = Math.max(3, Math.round(unit * 0.07));
  if (sky.night) {
    ctx.fillStyle = P.paper;
    for (let y = -br; y <= br; y++) {
      for (let x = -br; x <= br; x++) {
        const inMoon = x * x + y * y <= br * br;
        const inBite = (x - br * 0.55) ** 2 + (y + br * 0.25) ** 2 <= br * br * 0.8;
        if (inMoon && !inBite) ctx.fillRect(bx + x, by + y, 1, 1);
      }
    }
  } else {
    // Dithered halo, then the disc, then an ink ring.
    for (let y = -br * 2; y <= br * 2; y++) {
      for (let x = -br * 2; x <= br * 2; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > br && d < br * 1.9 && !dither(bx + x, by + y, (d - br) / (br * 0.9))) {
          ctx.fillStyle = P.goldPale;
          ctx.fillRect(bx + x, by + y, 1, 1);
        }
      }
    }
    ctx.fillStyle = P.gold;
    circle(ctx, bx, by, br, true);
    ctx.fillStyle = P.ink;
    circle(ctx, bx, by, br);
  }

  // Clouds drift by day: paper puffs with an ink outline, Sam Cox style.
  if (!sky.night) {
    const rc = rng(seed ^ 0xc10d);
    const n = 2 + Math.floor(rc() * 3);
    for (let i = 0; i < n; i++) {
      const cw = Math.round(unit * (0.12 + rc() * 0.12));
      const speed = 0.6 + rc();
      const cx = Math.round(((rc() * (w + cw) + t * speed) % (w + cw * 2)) - cw);
      const cy = Math.round(h * (0.08 + rc() * 0.3));
      drawCloud(ctx, cx, cy, cw);
    }
  }

  // Hills, back to front. Each gets an ink line along its ridge.
  const layers = makeLayers(seed);
  const colors = sky.night ? HILLS_NIGHT : HILLS_DAY;
  const ridges: Int16Array[] = [];
  layers.forEach((layer, k) => {
    const tops = new Int16Array(w);
    for (let x = 0; x < w; x++) tops[x] = hillY(layer, x, w, h);
    ridges.push(tops);
    ctx.fillStyle = colors[k] as string;
    for (let x = 0; x < w; x++) ctx.fillRect(x, tops[x] as number, 1, h - (tops[x] as number));
    ctx.fillStyle = P.ink;
    for (let x = 0; x < w; x++) {
      const cur = tops[x] as number;
      const prev = x > 0 ? (tops[x - 1] as number) : cur;
      const lo = Math.min(prev, cur);
      const hi = Math.max(prev, cur);
      ctx.fillRect(x, lo, 1, Math.max(1, hi - lo));
    }
    // Trees on the second layer.
    if (k === 1) {
      const rt = rng(seed ^ 0x7ee);
      const count = Math.max(2, Math.round(w / 28));
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rt() * w);
        drawTree(ctx, x, tops[x] as number, Math.max(2, Math.round(unit * 0.035)), sky.night);
      }
    }
  });

  // Fireflies over the front hills at night.
  if (sky.night) {
    const rf = rng(seed ^ 0xf1);
    for (let i = 0; i < Math.round(w / 12); i++) {
      const x = Math.round(rf() * w + Math.sin(t * 0.7 + i) * 3);
      const y = Math.round(h * (0.75 + rf() * 0.2) + Math.cos(t * 0.9 + i * 2) * 2);
      if (Math.sin(t * 2 + i * 1.7) > 0.2) {
        ctx.fillStyle = P.gold;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // A small critter walks along the front ridge.
  const front = ridges[ridges.length - 1] as Int16Array;
  if (o.critter) {
    const size = 12;
    const span = w + size * 2;
    const x = Math.round(((t * 6) % span) - size);
    const xi = Math.min(w - 1, Math.max(0, x + 6));
    drawCritter(ctx, x, (front[xi] as number) - size + 1, {
      seed: seed ^ 0xbeef,
      frame: Math.floor(t * 4) % 2,
    });
  }

  // Grass tufts on the front layer, deterministic per seed.
  ctx.fillStyle = P.ink;
  for (let i = 0; i < w / 6; i++) {
    const x = Math.floor(r() * w);
    const top = front[x] as number;
    const y = top + 3 + Math.floor(r() * (h - top - 3));
    if (y < h) {
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillRect(x + 1, y - 1, 1, 1);
    }
  }

  return sky;
}

function drawCloud(ctx: Ctx, x: number, y: number, cw: number) {
  const ch = Math.max(3, Math.round(cw * 0.35));
  const puffs: [number, number, number][] = [
    [0.25, 0.6, 0.3],
    [0.5, 0.4, 0.38],
    [0.75, 0.62, 0.28],
  ];
  // Fill first, then trace an outline by testing the shape's edge.
  const inside = (px: number, py: number) =>
    puffs.some(([fx, fy, fr]) => (px - fx * cw) ** 2 + (py - fy * ch) ** 2 <= (fr * cw) ** 2) &&
    py <= ch;
  for (let py = -Math.round(cw * 0.2); py <= ch + 1; py++) {
    for (let px = -1; px <= cw + 1; px++) {
      if (inside(px, py)) {
        const edge =
          !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
        ctx.fillStyle = edge ? P.ink : P.paper;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
}

function drawTree(ctx: Ctx, x: number, ground: number, r: number, night: boolean) {
  ctx.fillStyle = P.ink;
  ctx.fillRect(x, ground - r * 2, 1, r * 2);
  const cy = ground - r * 2 - r + 1;
  ctx.fillStyle = night ? '#16402b' : P.green;
  circle(ctx, x, cy, r, true);
  ctx.fillStyle = P.ink;
  circle(ctx, x, cy, r);
}
