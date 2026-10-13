/** 1536 -> '1.5 KB'. */
export function bytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export { clock, preciseClock } from '@shiqi/lab';

/** A meter's full scale: the next power of two at or above `value`, never below `min`. */
export function meterScale(value: number, min: number): number {
  let scale = min;
  while (scale < value) scale *= 2;
  return scale;
}
