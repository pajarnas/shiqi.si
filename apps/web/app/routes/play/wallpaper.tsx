import {
  PATTERN_THEMES,
  drawPattern,
  drawScene,
  downloadCanvas,
  hash,
  skyFor,
  upscale,
  type PatternTheme,
} from '@shiqi/pixel';
import {
  Button,
  Card,
  Cluster,
  Field,
  PixelCanvas,
  Range,
  Segmented,
  Select,
  Stack,
  Swatches,
  TextInput,
  type DrawFrame,
} from '@shiqi/ui';
import { useCallback, useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { format, useI18n } from '~/i18n';
import type { Route } from './+types/wallpaper';

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({
    title: t.entries.wallpaper.title,
    description: t.wallpaper.description,
  }));

// Device names are product names, the same in every language; the 4K monitor's
// label comes from the dictionary.
const SIZES = [
  { id: 'iphone', label: 'iPhone 16 / 17', w: 1179, h: 2556 },
  { id: 'iphone-max', label: 'iPhone Pro Max', w: 1320, h: 2868 },
  { id: 'mba13', label: 'MacBook Air 13″', w: 2560, h: 1664 },
  { id: 'mbp14', label: 'MacBook Pro 14″', w: 3024, h: 1964 },
  { id: 'ipad', label: 'iPad Air 11″', w: 2360, h: 1640 },
  { id: '4k', label: null, w: 3840, h: 2160 },
] as const;

type Mode = '1984' | 'landscape';

/** Pattern themes offered, named by their key in strings.colors. */
const SWATCHES: readonly PatternTheme[] = ['gold', 'green', 'mint', 'paper', 'ink', 'forest'];

const PREVIEW_MAX = 720;

export default function Wallpaper() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('1984');
  const [sizeId, setSizeId] = useState<(typeof SIZES)[number]['id']>('mba13');
  const [theme, setTheme] = useState<PatternTheme>('gold');
  const [density, setDensity] = useState(60);
  const [tilt, setTilt] = useState(-12);
  const [iconPx, setIconPx] = useState(6);
  const [hour, setHour] = useState(16.5);
  const [word, setWord] = useState('shiqi');

  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
  const seed = hash(word);
  const k = Math.min(1, PREVIEW_MAX / Math.max(size.w, size.h));
  const pw = Math.round(size.w * k);
  const ph = Math.round(size.h * k);
  // Landscape renders at low resolution and scales up, so pixels stay chunky.
  const pixel = Math.max(2, Math.round(Math.min(size.w, size.h) / 200));

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, scale: number, t: number) => {
      if (mode === '1984') {
        drawPattern(ctx, {
          w,
          h,
          seed,
          t,
          ...PATTERN_THEMES[theme],
          cell: Math.max(1, Math.round(iconPx * scale)),
          density: density / 100,
          tilt,
        });
      } else {
        drawScene(ctx, { w, h, seed, hour, t, critter: false });
      }
    },
    [mode, seed, theme, iconPx, density, tilt, hour],
  );

  const draw = useCallback(
    ({ ctx, w, h, t }: DrawFrame) => {
      if (mode === '1984') {
        render(ctx, w, h, w / size.w, t);
        return;
      }
      // Draw the low-res scene into a buffer, then scale it into the preview.
      const lw = Math.round(size.w / pixel);
      const lh = Math.round(size.h / pixel);
      const buf = document.createElement('canvas');
      buf.width = lw;
      buf.height = lh;
      const bctx = buf.getContext('2d');
      if (!bctx) return;
      render(bctx, lw, lh, 1, t);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, 0, 0, w, h);
    },
    [mode, render, size.w, size.h, pixel],
  );

  const download = () => {
    const out = document.createElement('canvas');
    if (mode === '1984') {
      out.width = size.w;
      out.height = size.h;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      render(ctx, size.w, size.h, 1, 0);
      downloadCanvas(out, `shiqi-1984-${theme}-${size.w}x${size.h}.png`);
    } else {
      out.width = Math.round(size.w / pixel);
      out.height = Math.round(size.h / pixel);
      const ctx = out.getContext('2d');
      if (!ctx) return;
      render(ctx, out.width, out.height, 1, 0);
      downloadCanvas(upscale(out, pixel), `shiqi-landscape-${size.w}x${size.h}.png`);
    }
  };

  const hh = String(Math.floor(hour)).padStart(2, '0');
  const mm = String(Math.round((hour % 1) * 60)).padStart(2, '0');

  return (
    <PageWindow page="wallpaper" title={t.entries.wallpaper.title} lede={t.wallpaper.lede}>
      <div className="stage">
        <div className="stage__canvas">
          <PixelCanvas
            key={`${mode}-${sizeId}`}
            draw={draw}
            width={pw}
            height={ph}
            animate
            fps={mode === '1984' ? 24 : 8}
            framed
            label={t.wallpaper.preview}
            style={{
              aspectRatio: `${size.w} / ${size.h}`,
              maxHeight: '70vh',
              width: 'auto',
              maxWidth: '100%',
            }}
          />
        </div>
        <Card padded className="stage__panel">
          <Stack gap={4}>
            <Segmented
              label={t.wallpaper.style}
              value={mode}
              onChange={setMode}
              options={[
                { value: '1984', label: t.wallpaper.styleIcons },
                { value: 'landscape', label: t.wallpaper.styleLandscape },
              ]}
            />
            <Field label={t.wallpaper.size}>
              {(p) => (
                <Select
                  {...p}
                  value={sizeId}
                  onChange={(e) => setSizeId(e.target.value as typeof sizeId)}
                >
                  {SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {format(t.wallpaper.sizeOption, {
                        label: s.label ?? t.wallpaper.monitor4k,
                        w: s.w,
                        h: s.h,
                      })}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {mode === '1984' ? (
              <>
                <div className="ui-field">
                  <span className="ui-field__label">{t.wallpaper.palette}</span>
                  <Swatches
                    label={t.wallpaper.palette}
                    value={theme}
                    onChange={(v) => setTheme(v as PatternTheme)}
                    colors={SWATCHES.map((s) => ({
                      value: s,
                      name: t.colors[s],
                      css: `linear-gradient(135deg, ${PATTERN_THEMES[s].from}, ${PATTERN_THEMES[s].to})`,
                    }))}
                  />
                </div>
                <Field label={format(t.wallpaper.iconSize, { n: iconPx })}>
                  {(p) => (
                    <Range
                      {...p}
                      min={3}
                      max={12}
                      value={iconPx}
                      onChange={(e) => setIconPx(Number(e.target.value))}
                    />
                  )}
                </Field>
                <Field label={format(t.wallpaper.density, { n: density })}>
                  {(p) => (
                    <Range
                      {...p}
                      min={20}
                      max={100}
                      value={density}
                      onChange={(e) => setDensity(Number(e.target.value))}
                    />
                  )}
                </Field>
                <Field label={format(t.wallpaper.tilt, { n: tilt })}>
                  {(p) => (
                    <Range
                      {...p}
                      min={-30}
                      max={30}
                      value={tilt}
                      onChange={(e) => setTilt(Number(e.target.value))}
                    />
                  )}
                </Field>
              </>
            ) : (
              <Field
                label={format(t.wallpaper.time, {
                  time: `${hh}:${mm}`,
                  sky: t.sky.names[skyFor(hour).id],
                })}
              >
                {(p) => (
                  <Range
                    {...p}
                    min={0}
                    max={23.75}
                    step={0.25}
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                  />
                )}
              </Field>
            )}
            <Field label={t.wallpaper.seed} hint={t.wallpaper.seedHint}>
              {(p) => <TextInput {...p} value={word} onChange={(e) => setWord(e.target.value)} />}
            </Field>
            <Cluster>
              <Button onClick={download}>{t.wallpaper.download}</Button>
              <Button
                variant="secondary"
                onClick={() => setWord(Math.random().toString(36).slice(2, 8))}
              >
                {t.wallpaper.random}
              </Button>
            </Cluster>
          </Stack>
        </Card>
      </div>
    </PageWindow>
  );
}
