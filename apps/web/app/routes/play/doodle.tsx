import { PALETTE, downloadCanvas, drawCell, hash, layoutDoodle, upscale } from '@shiqi/pixel';
import {
  Button,
  Card,
  Cluster,
  Field,
  PixelCanvas,
  Segmented,
  Stack,
  TextInput,
  useReducedMotion,
  type DrawFrame,
} from '@shiqi/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { format, useI18n } from '~/i18n';
import type { Route } from './+types/doodle';

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({ title: t.entries.doodle.title, description: t.doodle.description }));

const SHAPES = {
  wide: { w: 160, h: 96 },
  square: { w: 128, h: 128 },
  tall: { w: 90, h: 160 },
} as const;
type Shape = keyof typeof SHAPES;

const EXPORT_SCALE = 8;

export default function Doodle() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [shape, setShape] = useState<Shape>('wide');
  const [word, setWord] = useState('doodle');
  const [shown, setShown] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { w, h } = SHAPES[shape];
  const cells = useMemo(() => layoutDoodle(hash(word), w, h), [word, w, h]);

  // Reveal the panels one at a time, like a pen moving across the wall.
  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- skip the animation
      setShown(cells.length);
      return;
    }
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= cells.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 45);
    return () => clearInterval(id);
  }, [cells, reduced]);

  const draw = useCallback(
    ({ ctx }: DrawFrame) => {
      ctx.fillStyle = PALETTE.paper;
      ctx.fillRect(0, 0, w, h);
      for (const c of cells.slice(0, shown)) drawCell(ctx, c);
    },
    [cells, shown, w, h],
  );

  const download = () => {
    const src = canvasRef.current;
    if (src) downloadCanvas(upscale(src, EXPORT_SCALE), `shiqi-doodle-${word}.png`);
  };

  return (
    <PageWindow page="doodle" title={t.entries.doodle.title} lede={t.doodle.lede}>
      <div className="stage">
        <div className="stage__canvas">
          <PixelCanvas
            canvasRef={canvasRef}
            draw={draw}
            width={w}
            height={h}
            framed
            label={format(t.doodle.canvas, { n: cells.length })}
            style={{
              aspectRatio: `${w} / ${h}`,
              maxHeight: '70vh',
              width: 'auto',
              maxWidth: '100%',
            }}
          />
        </div>
        <Card padded className="stage__panel">
          <Stack gap={4}>
            <Segmented
              label={t.doodle.shape}
              value={shape}
              onChange={setShape}
              options={(Object.keys(SHAPES) as Shape[]).map((k) => ({
                value: k,
                label: t.doodle.shapes[k],
              }))}
            />
            <Field label={t.doodle.seed} hint={format(t.doodle.seedHint, { n: cells.length })}>
              {(p) => <TextInput {...p} value={word} onChange={(e) => setWord(e.target.value)} />}
            </Field>
            <Cluster>
              <Button onClick={() => setWord(Math.random().toString(36).slice(2, 8))}>
                {t.doodle.again}
              </Button>
              <Button variant="secondary" onClick={download} disabled={shown < cells.length}>
                {t.doodle.download}
              </Button>
            </Cluster>
            <p className="ui-field__hint">
              {format(t.doodle.exportHint, {
                w: w * EXPORT_SCALE,
                h: h * EXPORT_SCALE,
                k: EXPORT_SCALE,
              })}
            </p>
          </Stack>
        </Card>
      </div>
    </PageWindow>
  );
}
