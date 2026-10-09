// Pixel pad model: a square grid of palette indices. Index 0 is transparent.
import { PALETTE, critterGrid } from '@shiqi/pixel';

export const PAD_SIZE = 32;

/** `name` is a key into strings.colors. */
export const PAD_COLORS = [
  { value: 'transparent', name: 'eraser' },
  { value: PALETTE.ink, name: 'ink' },
  { value: PALETTE.paper, name: 'paper' },
  { value: PALETTE.gold, name: 'gold' },
  { value: PALETTE.goldDeep, name: 'goldDeep' },
  { value: PALETTE.goldPale, name: 'goldPale' },
  { value: PALETTE.green, name: 'green' },
  { value: PALETTE.greenDeep, name: 'greenDeep' },
  { value: PALETTE.greenPale, name: 'greenPale' },
] as const;

export type Grid = Uint8Array;

export const emptyGrid = (): Grid => new Uint8Array(PAD_SIZE * PAD_SIZE);

/** Paint one cell, and its mirror across the vertical axis when `mirror` is on. */
export function paint(grid: Grid, x: number, y: number, color: number, mirror: boolean): Grid {
  if (x < 0 || y < 0 || x >= PAD_SIZE || y >= PAD_SIZE) return grid;
  const next = grid.slice();
  next[y * PAD_SIZE + x] = color;
  if (mirror) next[y * PAD_SIZE + (PAD_SIZE - 1 - x)] = color;
  return next;
}

/** 4-way flood fill from (x, y). */
export function fill(grid: Grid, x: number, y: number, color: number): Grid {
  const target = grid[y * PAD_SIZE + x];
  if (target === undefined || target === color) return grid;
  const next = grid.slice();
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop() as [number, number];
    if (cx < 0 || cy < 0 || cx >= PAD_SIZE || cy >= PAD_SIZE) continue;
    const i = cy * PAD_SIZE + cx;
    if (next[i] !== target) continue;
    next[i] = color;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

/** A starter drawing: a critter, scaled 2x and centred. */
export function starterGrid(seed: number): Grid {
  const g = emptyGrid();
  const { grid, fill: body } = critterGrid(seed);
  const bodyIndex = Math.max(
    1,
    PAD_COLORS.findIndex((c) => c.value === body),
  );
  const map = [0, 1, bodyIndex, 2, 3];
  grid.forEach((row, y) =>
    row.forEach((v, x) => {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++)
          g[(4 + y * 2 + dy) * PAD_SIZE + 4 + x * 2 + dx] = map[v] ?? 0;
      }
    }),
  );
  return g;
}

/** Export as SVG with one rect per horizontal run of the same colour. */
export function toSvg(grid: Grid): string {
  const rects: string[] = [];
  for (let y = 0; y < PAD_SIZE; y++) {
    let x = 0;
    while (x < PAD_SIZE) {
      const c = grid[y * PAD_SIZE + x] ?? 0;
      let end = x + 1;
      while (end < PAD_SIZE && grid[y * PAD_SIZE + end] === c) end++;
      if (c)
        rects.push(
          `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${PAD_COLORS[c]?.value}"/>`,
        );
      x = end;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAD_SIZE} ${PAD_SIZE}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

export const encodeGrid = (g: Grid) => Array.from(g).join('');
export function decodeGrid(s: unknown): Grid | null {
  if (typeof s !== 'string' || s.length !== PAD_SIZE * PAD_SIZE || !/^\d+$/.test(s)) return null;
  return Uint8Array.from(s, (ch) => Math.min(Number(ch), PAD_COLORS.length - 1));
}
