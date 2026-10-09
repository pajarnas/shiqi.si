// Helpers for nested string dictionaries: merge a partial translation over the
// English original, and list which strings a translation still lacks.

export type DeepPartial<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? DeepPartial<U>[]
    : { [K in keyof T]?: DeepPartial<T[K]> };

type Tree = string | Tree[] | { [key: string]: Tree };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** `base` with every string `over` provides swapped in. Shape always follows `base`. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (typeof base === 'string') return (typeof over === 'string' ? over : base) as T;
  if (Array.isArray(base)) {
    const o = Array.isArray(over) ? over : [];
    return base.map((b, i) => deepMerge(b, o[i])) as T;
  }
  if (isObject(base)) {
    const o = isObject(over) ? over : {};
    return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, deepMerge(v, o[k])])) as T;
  }
  return base;
}

export type Path = (string | number)[];

/** Every string in `base` that `over` doesn't provide, with its path. Empty strings are skipped. */
export function missingStrings(base: unknown, over: unknown, path: Path = []) {
  const out: { path: Path; text: string }[] = [];
  if (typeof base === 'string') {
    if (base && typeof over !== 'string') out.push({ path, text: base });
  } else if (Array.isArray(base)) {
    const o = Array.isArray(over) ? over : [];
    base.forEach((b, i) => out.push(...missingStrings(b, o[i], [...path, i])));
  } else if (isObject(base)) {
    const o = isObject(over) ? over : {};
    for (const [k, v] of Object.entries(base)) out.push(...missingStrings(v, o[k], [...path, k]));
  }
  return out;
}

/** A sparse tree holding `value` at `path`, merged into `into`. */
export function setPath(into: Record<string, Tree>, path: Path, value: string) {
  let node: Record<string | number, Tree> = into;
  path.forEach((key, i) => {
    if (i === path.length - 1) {
      node[key] = value;
      return;
    }
    const next = node[key];
    if (!isObject(next)) node[key] = typeof path[i + 1] === 'number' ? [] : {};
    node = node[key] as Record<string | number, Tree>;
  });
  return into;
}
