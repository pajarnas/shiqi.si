import { COUNTRY_SHAPES, MAP_HEIGHT, MAP_WIDTH, shade } from '~/features/visits/worldmap';

export interface VisitorMapProps {
  /** Visitors per ISO country code. */
  counts: Record<string, number>;
  /** Country names in the page's language, by code. */
  names: Record<string, string>;
  /** Hover text for a country, given its name and count. */
  label: (name: string, count: number) => string;
  /** Accessible description of the whole map. */
  title: string;
}

/** A pixel world map with countries shaded by how many people came from them. */
export function VisitorMap({ counts, names, label, title }: VisitorMapProps) {
  const max = Math.max(0, ...Object.values(counts));
  const visited = [...COUNTRY_SHAPES].filter(([code]) => code && counts[code]);
  return (
    <svg
      className="visitor-map"
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
    >
      <path className="visitor-map__land" d={[...COUNTRY_SHAPES.values()].join('')} />
      {visited.map(([code, d]) => {
        const n = counts[code] ?? 0;
        return (
          <path key={code} className={`visitor-map__hit visitor-map__hit--${shade(n, max)}`} d={d}>
            <title>{label(names[code] ?? code, n)}</title>
          </path>
        );
      })}
    </svg>
  );
}
