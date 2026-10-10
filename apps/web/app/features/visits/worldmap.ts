// The pixel world map: decodes the generated grid into one SVG path per country.
import { MAP_CODES, MAP_HEIGHT, MAP_ROWS, MAP_WIDTH } from './worldmap.data';

export { MAP_HEIGHT, MAP_WIDTH };

/** Every land cell, by country code ('' for land without one). */
export const COUNTRY_SHAPES: ReadonlyMap<string, string> = (() => {
  const paths = new Map<string, string[]>();
  MAP_ROWS.forEach((row, y) => {
    for (const run of row.split(' ')) {
      if (!run) continue;
      const [x = 0, len = 0, i = 0] = run.split('.').map((n) => Number.parseInt(n, 36));
      const code = MAP_CODES[i] ?? '';
      let d = paths.get(code);
      if (!d) paths.set(code, (d = []));
      d.push(`M${x} ${y}h${len}v1h-${len}z`);
    }
  });
  return new Map([...paths].map(([code, d]) => [code, d.join('')]));
})();

/** Shade 1–4 for a count, on a log scale against the busiest country. */
export function shade(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  if (max === 1) return 4;
  return 1 + Math.round((3 * Math.log(count)) / Math.log(max));
}
