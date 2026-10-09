// Raster primitives that draw whole pixels only: no anti-aliasing, ever.

export type Ctx = CanvasRenderingContext2D;

/** 4x4 Bayer matrix, normalised to (0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Ordered dithering: true when pixel (x, y) takes the second colour at mix ratio t in [0, 1]. */
export function dither(x: number, y: number, t: number): boolean {
  return t > (BAYER[(y & 3) * 4 + (x & 3)] as number);
}

/** Size a canvas to `w x h` logical pixels and return a context with smoothing off. */
export function pixelContext(canvas: HTMLCanvasElement, w: number, h: number): Ctx {
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** 1-pixel line, Bresenham. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  x0 |= 0;
  y0 |= 0;
  x1 |= 0;
  y1 |= 0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Midpoint circle. `fill` draws a solid disc instead of an outline. */
export function circle(ctx: Ctx, cx: number, cy: number, r: number, fill = false): void {
  cx |= 0;
  cy |= 0;
  r |= 0;
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    if (fill) {
      ctx.fillRect(cx - x, cy + y, 2 * x + 1, 1);
      ctx.fillRect(cx - x, cy - y, 2 * x + 1, 1);
      ctx.fillRect(cx - y, cy + x, 2 * y + 1, 1);
      ctx.fillRect(cx - y, cy - x, 2 * y + 1, 1);
    } else {
      const pts = [
        [x, y],
        [y, x],
        [-y, x],
        [-x, y],
        [-x, -y],
        [-y, -x],
        [y, -x],
        [x, -y],
      ] as const;
      for (const [px, py] of pts) ctx.fillRect(cx + px, cy + py, 1, 1);
    }
    y++;
    if (err < 0) {
      err += 2 * y + 1;
    } else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

/** Copy a canvas into a new one scaled by an integer factor, edges kept hard. */
export function upscale(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width * scale;
  out.height = src.height * scale;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Save a canvas as a PNG download. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, filename);
  }, 'image/png');
}

/** Save any blob as a download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
