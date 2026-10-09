// Small live previews shared by the home page and toy pages.
import {
  CRITTER_SIZE,
  PALETTE,
  PATTERN_THEMES,
  dayOfYear,
  drawCell,
  drawCritter,
  drawPattern,
  drawScene,
  hash,
  isoDate,
  layoutDoodle,
  skyFor,
} from '@shiqi/pixel';
import { PixelCanvas, type DrawFrame } from '@shiqi/ui';
import { useCallback } from 'react';

const hourNow = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

/** The landscape at the visitor's local time, with a critter walking by. */
export function LiveSky({ label = '跟随你本地时间变化的像素风景' }: { label?: string }) {
  const draw = useCallback(({ ctx, w, h, t }: DrawFrame) => {
    drawScene(ctx, { w, h, seed: 7, hour: hourNow(), t, critter: true });
  }, []);
  return <PixelCanvas draw={draw} width={192} height={96} animate fps={12} label={label} />;
}

export function skyNameNow(): string {
  return skyFor(hourNow()).name;
}

/** Today's critter: one per day, the same for everyone on that date. */
export function todaysCritterSeed(d = new Date()): number {
  return hash(isoDate(d));
}

export function CritterCanvas({
  seed,
  frame = 0,
  label,
}: {
  seed: number;
  frame?: number;
  label?: string;
}) {
  const draw = useCallback(
    ({ ctx, w, h }: DrawFrame) => {
      ctx.clearRect(0, 0, w, h);
      drawCritter(ctx, 1, 1, { seed, frame });
    },
    [seed, frame],
  );
  return (
    <PixelCanvas draw={draw} width={CRITTER_SIZE + 2} height={CRITTER_SIZE + 2} label={label} />
  );
}

export { dayOfYear };

/** Card thumbnails for the toys. */
export function ToyThumb({ kind }: { kind: 'wallpaper' | 'doodle' | 'pad' }) {
  const draw = useCallback(
    ({ ctx, w, h, t }: DrawFrame) => {
      if (kind === 'wallpaper') {
        drawPattern(ctx, { w, h, seed: 3, cell: 1, t, ...PATTERN_THEMES.green, density: 0.7 });
      } else if (kind === 'doodle') {
        for (const c of layoutDoodle(11, w, h)) drawCell(ctx, c);
      } else {
        ctx.fillStyle = PALETTE.paper;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(18,18,18,0.12)';
        for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
        drawCritter(ctx, Math.floor(w / 2) - 24, Math.floor(h / 2) - 24, { seed: 2026, scale: 4 });
      }
    },
    [kind],
  );
  return (
    <PixelCanvas draw={draw} width={128} height={96} animate={kind === 'wallpaper'} fps={12} />
  );
}
