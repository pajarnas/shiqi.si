/** The site palette. Generators draw from these colours only. */
export const PALETTE = Object.freeze({
  ink: '#121212',
  paper: '#fbf8ef',
  gold: '#f2b51b',
  goldDeep: '#c98a0c',
  goldPale: '#fbe7a6',
  green: '#1f9d55',
  greenDeep: '#0d5c35',
  greenPale: '#bfe6c8',
  mint: '#9fd7c2',
  night: '#0e1f1a',
});

export type PaletteName = keyof typeof PALETTE;

/** Parse `#rrggbb` into [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
