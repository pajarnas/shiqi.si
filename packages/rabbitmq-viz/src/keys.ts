// A colour per routing key, so one key's messages can be followed from the
// publisher through the exchange into every queue they land in.

/** How many key colours the theme defines (--rv-key-0 … --rv-key-5). */
export const KEY_COLORS = 6;

/** Keys the stories use, each with its own colour. */
const KNOWN = [
  'hello',
  'task',
  'error',
  'info',
  'warning',
  'debug',
  'order.created',
  'order.paid',
  'order.cancelled',
  'paid',
  'refund',
];
const SLOTS = new Map<string, number>(KNOWN.map((k, i) => [k, i % KEY_COLORS]));

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** A stable colour slot for a routing key; the empty key gets none. */
export const keySlot = (key: string): number | null =>
  key === '' ? null : (SLOTS.get(key) ?? hash(key) % KEY_COLORS);

/** The CSS custom property holding a key's colour. */
export const keyVar = (key: string) => {
  const slot = keySlot(key);
  return slot === null ? '--rv-key-none' : `--rv-key-${slot}`;
};

export const keyColor = (key: string) => `var(${keyVar(key)})`;
