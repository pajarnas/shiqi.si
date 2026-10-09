// Little doodle critters: a 12x12 sprite generated from a seed.
// Same seed, same critter.

import { PALETTE as P } from './palette';
import { pick, rng } from './random';
import type { Ctx } from './raster';

export const CRITTER_SIZE = 12;

const FILLS = [P.paper, P.gold, P.green, P.goldPale, P.greenPale] as const;
/** Names are two parts picked from lists of this length; apps supply the words. */
export const CRITTER_NAME_PARTS = 8;

/** Cell values: 0 empty, 1 ink, 2 body, 3 eye white, 4 accent. */
export type CritterGrid = Uint8Array[];

export function critterGrid(seed: number, frame = 0): { grid: CritterGrid; fill: string } {
  const S = CRITTER_SIZE;
  const r = rng(seed);
  const g: CritterGrid = Array.from({ length: S }, () => new Uint8Array(S));
  const set = (x: number, y: number, v: number) => {
    const row = g[y];
    if (row && x >= 0 && x < S) row[x] = v;
  };
  const get = (x: number, y: number) => g[y]?.[x] ?? 0;

  const rx = 3.6 + r() * 1.6;
  const ry = 3 + r() * 1.4;
  const cx = 5.5;
  const cy = 5.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, 2);
    }
  }

  // Ears or antennae, mirrored.
  const top = Math.ceil(cy - ry);
  const ex = Math.round(cx - rx * 0.5);
  const style = Math.floor(r() * 3);
  if (style === 0) {
    set(ex, top - 1, 1);
    set(S - 1 - ex, top - 1, 1);
    set(ex - 1, top - 2, 4);
    set(S - ex, top - 2, 4);
  } else if (style === 1) {
    set(ex, top - 1, 2);
    set(S - 1 - ex, top - 1, 2);
  }

  // Outline every body pixel that touches empty space.
  const edge: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (get(x, y) !== 2) continue;
      if (
        get(x - 1, y) !== 2 ||
        get(x + 1, y) !== 2 ||
        get(x, y - 1) !== 2 ||
        get(x, y + 1) !== 2
      ) {
        edge.push([x, y]);
      }
    }
  }
  for (const [x, y] of edge) set(x, y, 1);

  // One, two or three eyes.
  const eyes = 1 + Math.floor(r() * 3);
  const ey = Math.round(cy - 1);
  const spots = eyes === 1 ? [5] : eyes === 2 ? [4, 7] : [3, 5, 8];
  for (const x of spots) {
    if (get(x, ey) === 2) set(x, ey, 3);
    if (get(x, ey + 1) === 2) set(x, ey + 1, 1);
  }

  const my = Math.round(cy + 1.5);
  const mouth = Math.floor(r() * 3);
  if (mouth === 0) {
    set(5, my, 1);
    set(6, my, 1);
  } else if (mouth === 1) {
    set(4, my, 1);
    set(5, my + 1, 1);
    set(6, my + 1, 1);
    set(7, my, 1);
  } else {
    set(5, my, 4);
    set(6, my, 4);
  }

  // Legs alternate between two frames.
  const by = Math.min(S - 1, Math.round(cy + ry) + 1);
  const legs = frame
    ? [
        [4, 0],
        [7, 1],
      ]
    : [
        [4, 1],
        [7, 0],
      ];
  for (const [x, lift] of legs) set(x as number, by - (lift as number), 1);

  return { grid: g, fill: pick(r, FILLS) };
}

export interface CritterOptions {
  seed: number;
  frame?: number;
  scale?: number;
}

export function drawCritter(ctx: Ctx, x: number, y: number, o: CritterOptions): void {
  const scale = o.scale ?? 1;
  const { grid, fill } = critterGrid(o.seed, o.frame ?? 0);
  const colors = [null, P.ink, fill, P.paper, fill === P.gold ? P.green : P.gold];
  grid.forEach((row, j) => {
    row.forEach((v, i) => {
      const c = colors[v];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    });
  });
}

/** Indexes of a two-part name, stable per seed. Each is below CRITTER_NAME_PARTS. */
export function critterNameParts(seed: number): readonly [number, number] {
  const r = rng(seed ^ 0xa11);
  const idx = Array.from({ length: CRITTER_NAME_PARTS }, (_, i) => i);
  return [pick(r, idx), pick(r, idx)];
}
