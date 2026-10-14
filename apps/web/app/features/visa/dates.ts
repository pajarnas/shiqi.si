// Date helpers for the visa tools. Dates are plain YYYY-MM-DD strings, worked
// out in UTC so a browser's time zone never shifts a day.
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function iso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return date.toISOString().slice(0, 10);
}

/** Reads a date written the usual ways (1960年3月5日, 1960/3/5, 5 March 1960, March 5, 1960). */
export function parseDate(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  let m = /^(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?$/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[\s./-]+([A-Z]{3})[A-Z]*\.?[\s./-]+(\d{4})$/.exec(s);
  if (m && MONTHS.includes(m[2]!))
    return iso(Number(m[3]), MONTHS.indexOf(m[2]!) + 1, Number(m[1]));
  m = /^([A-Z]{3})[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m && MONTHS.includes(m[1]!))
    return iso(Number(m[3]), MONTHS.indexOf(m[1]!) + 1, Number(m[2]));
  return null;
}

/** The DS-160 way: day, three-letter month, year, as picked from its drop-downs. */
export function ds160Date(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Adds months, landing on the month's last day when the day does not exist (Aug 31 + 6 → Feb 28). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}
