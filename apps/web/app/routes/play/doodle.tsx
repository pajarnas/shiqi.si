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

export const meta = () => pageMeta('涂鸦墙', '把画面分成格子，每格画一个小东西，一格都不留空。');

const SHAPES = {
  wide: { w: 160, h: 96, label: '横幅' },
  square: { w: 128, h: 128, label: '方形' },
  tall: { w: 90, h: 160, label: '手机' },
} as const;
type Shape = keyof typeof SHAPES;

const EXPORT_SCALE = 8;

export default function Doodle() {
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
    <PageWindow
      file="play/doodle"
      eyebrow="DOODLE"
      title="涂鸦墙"
      lede="规则只有一条：一格都不留空。笑脸、眼睛、小房子、波浪、螺旋和小怪，随机分到每个格子里。"
    >
      <div className="stage">
        <div className="stage__canvas">
          <PixelCanvas
            canvasRef={canvasRef}
            draw={draw}
            width={w}
            height={h}
            framed
            label={`涂鸦墙，共 ${cells.length} 格`}
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
              label="画幅"
              value={shape}
              onChange={setShape}
              options={(Object.keys(SHAPES) as Shape[]).map((k) => ({
                value: k,
                label: SHAPES[k].label,
              }))}
            />
            <Field label="种子" hint={`${cells.length} 个格子。同一个词画出同一面墙。`}>
              {(p) => <TextInput {...p} value={word} onChange={(e) => setWord(e.target.value)} />}
            </Field>
            <Cluster>
              <Button onClick={() => setWord(Math.random().toString(36).slice(2, 8))}>
                再画一张
              </Button>
              <Button variant="secondary" onClick={download} disabled={shown < cells.length}>
                下载 PNG
              </Button>
            </Cluster>
            <p className="ui-field__hint">
              导出为 {w * EXPORT_SCALE}×{h * EXPORT_SCALE}，每个像素放大 {EXPORT_SCALE} 倍。
            </p>
          </Stack>
        </Card>
      </div>
    </PageWindow>
  );
}
