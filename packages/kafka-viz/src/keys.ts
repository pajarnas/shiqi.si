import { murmur2, toPositive } from '@shiqi/kafka';

/** How many key colours the theme defines (--kv-key-0 … --kv-key-5). */
export const KEY_COLORS = 6;

/** A stable colour slot for a record key; null keys get none. */
export const keySlot = (key: string | null) =>
  key === null ? null : toPositive(murmur2(key)) % KEY_COLORS;

/** CSS colour for a key, from the theme. */
export const keyColor = (key: string | null) => {
  const slot = keySlot(key);
  return slot === null ? 'var(--kv-key-none)' : `var(--kv-key-${slot})`;
};
