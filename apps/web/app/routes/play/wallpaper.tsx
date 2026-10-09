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

export const meta = () =>
  pageMeta('像素壁纸', '生成 1984 图标风或像素风景壁纸，按你的设备尺寸下载 PNG。');

const SIZES = [
  { id: 'iphone', label: 'iPhone 16 / 17', w: 1179, h: 2556 },
  { id: 'iphone-max', label: 'iPhone Pro Max', w: 1320, h: 2868 },
  { id: 'mba13', label: 'MacBook Air 13″', w: 2560, h: 1664 },
  { id: 'mbp14', label: 'MacBook Pro 14″', w: 3024, h: 1964 },
  { id: 'ipad', label: 'iPad Air 11″', w: 2360, h: 1640 },
  { id: '4k', label: '4K 显示器', w: 3840, h: 2160 },
] as const;

type Mode = '1984' | 'landscape';

const SWATCHES: { value: PatternTheme; name: string }[] = [
  { value: 'gold', name: '金' },
  { value: 'green', name: '绿' },
  { value: 'mint', name: '薄荷' },
  { value: 'paper', name: '纸' },
  { value: 'ink', name: '墨' },
  { value: 'forest', name: '森林' },
];

const PREVIEW_MAX = 720;

export default function Wallpaper() {
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
    <PageWindow
      file="play/wallpaper"
      eyebrow="WALLPAPER"
      title="像素壁纸"
      lede="两种风格：一种是满屏同色调的小图标，一种是会随时间变色的像素山丘。选好尺寸，直接下载原尺寸 PNG。"
    >
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
            label="壁纸预览"
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
              label="风格"
              value={mode}
              onChange={setMode}
              options={[
                { value: '1984', label: '1984 图标' },
                { value: 'landscape', label: '像素风景' },
              ]}
            />
            <Field label="尺寸">
              {(p) => (
                <Select
                  {...p}
                  value={sizeId}
                  onChange={(e) => setSizeId(e.target.value as typeof sizeId)}
                >
                  {SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}（{s.w}×{s.h}）
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {mode === '1984' ? (
              <>
                <div className="ui-field">
                  <span className="ui-field__label">配色</span>
                  <Swatches
                    label="配色"
                    value={theme}
                    onChange={(v) => setTheme(v as PatternTheme)}
                    colors={SWATCHES.map((s) => ({
                      ...s,
                      css: `linear-gradient(135deg, ${PATTERN_THEMES[s.value].from}, ${PATTERN_THEMES[s.value].to})`,
                    }))}
                  />
                </div>
                <Field label={`图标大小 ${iconPx}px`}>
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
                <Field label={`密度 ${density}%`}>
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
                <Field label={`倾斜 ${tilt}°`}>
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
              <Field label={`时间 ${hh}:${mm} · ${skyFor(hour).name}`}>
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
            <Field label="种子" hint="同一个词永远生成同一张图。">
              {(p) => <TextInput {...p} value={word} onChange={(e) => setWord(e.target.value)} />}
            </Field>
            <Cluster>
              <Button onClick={download}>下载 PNG</Button>
              <Button
                variant="secondary"
                onClick={() => setWord(Math.random().toString(36).slice(2, 8))}
              >
                随机
              </Button>
            </Cluster>
          </Stack>
        </Card>
      </div>
    </PageWindow>
  );
}
