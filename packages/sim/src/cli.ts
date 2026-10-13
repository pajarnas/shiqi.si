// Small helpers for command-line emulators: split a line like a shell does,
// and print tables like the admin tools do.

/** Split a command line into words, honouring single and double quotes. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let has = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur);
      cur = '';
      has = false;
    } else {
      cur += ch;
    }
  }
  if (has || cur) out.push(cur);
  return out;
}

/** Columns padded to the widest cell; a missing cell prints as '-'. */
export function table(headers: string[], rows: (string | number | undefined)[][]): string[] {
  const cells = [headers, ...rows.map((r) => r.map((c) => (c === undefined ? '-' : String(c))))];
  const widths = headers.map((_, i) => Math.max(...cells.map((r) => (r[i] ?? '').length)));
  return cells.map((r) =>
    r
      .map((c, i) => (c ?? '').padEnd(widths[i] ?? 0))
      .join(' ')
      .trimEnd(),
  );
}
