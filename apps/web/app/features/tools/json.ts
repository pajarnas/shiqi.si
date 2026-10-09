// JSON formatting with useful error positions.

export type JsonResult =
  { ok: true; text: string } | { ok: false; error: string; line?: number; column?: number };

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** Line and column (both 1-based) of a character offset. */
export function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset).split('\n');
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

export function formatJson(
  input: string,
  opts: { indent: number | '\t' | 0; sortKeys?: boolean },
): JsonResult {
  try {
    let value: unknown = JSON.parse(input);
    if (opts.sortKeys) value = sortDeep(value);
    return { ok: true, text: JSON.stringify(value, null, opts.indent || undefined) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const lc = message.match(/line (\d+) column (\d+)/);
    if (lc) return { ok: false, error: message, line: Number(lc[1]), column: Number(lc[2]) };
    const pos = message.match(/position (\d+)/);
    if (pos) return { ok: false, error: message, ...lineColumn(input, Number(pos[1])) };
    return { ok: false, error: message };
  }
}
