// Instants: parse what people paste, format it the standard ways.

export type InstantKind = 'unix-s' | 'unix-ms' | 'text';

export interface ParsedInstant {
  date: Date;
  kind: InstantKind;
}

/**
 * Accepts Unix seconds, Unix milliseconds or any string Date.parse understands
 * (ISO 8601 above all). Numbers of 12 digits or more are read as milliseconds.
 */
export function parseInstant(input: string): ParsedInstant | null {
  const s = input.trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const digits = s.replace(/^-/, '').split('.')[0]?.length ?? 0;
    const kind: InstantKind = digits >= 12 ? 'unix-ms' : 'unix-s';
    const date = new Date(kind === 'unix-ms' ? n : n * 1000);
    return Number.isNaN(date.getTime()) ? null : { date, kind };
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : { date: new Date(t), kind: 'text' };
}

const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');

/** ISO 8601 in local time with the UTC offset, e.g. 2026-10-08T23:13:14.000-04:00. */
export function toLocalIso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  );
}

/** ISO 8601 week date of the local calendar day, e.g. 2026-W41-5. */
export function isoWeek(d: Date): { year: number; week: number; day: number; label: string } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  // Move to the Thursday of this week: its year is the ISO year.
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((date.getTime() - jan1) / 864e5 + 1) / 7);
  return { year, week, day, label: `${year}-W${pad(week)}-${day}` };
}

/** "3 天前" / "2 小时后", picking the largest sensible unit. */
export function relative(d: Date, now: Date, locale = 'zh-CN'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const sec = (d.getTime() - now.getTime()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(sec) >= size || unit === 'second') return rtf.format(Math.round(sec / size), unit);
  }
  return '';
}

export function formatInstant(d: Date, now: Date) {
  return [
    { label: 'Unix 秒', value: String(Math.floor(d.getTime() / 1000)) },
    { label: 'Unix 毫秒', value: String(d.getTime()) },
    { label: 'ISO 8601 (UTC)', value: d.toISOString() },
    { label: 'ISO 8601 (本地)', value: toLocalIso(d) },
    { label: 'RFC 9110 (HTTP)', value: d.toUTCString() },
    { label: 'ISO 周', value: isoWeek(d).label },
    { label: '相对现在', value: relative(d, now) },
  ];
}
