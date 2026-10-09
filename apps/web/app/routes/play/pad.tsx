import { PALETTE, downloadBlob, downloadCanvas, hash, isoDate } from '@shiqi/pixel';
import {
  Button,
  Card,
  Checkbox,
  Cluster,
  Kbd,
  Segmented,
  Stack,
  Swatches,
  useMounted,
} from '@shiqi/ui';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import {
  PAD_COLORS,
  PAD_SIZE,
  decodeGrid,
  emptyGrid,
  encodeGrid,
  fill,
  paint,
  starterGrid,
  toSvg,
  type Grid,
} from '~/features/play/pad';

export const meta = () =>
  pageMeta('像素画板', '32×32 像素画板：镜像、填充、撤销，导出 PNG 和 SVG，自动保存在本地。');

type Tool = 'pen' | 'eraser' | 'fill';
const CELL = 16;
const STORAGE_KEY = 'shiqi:pad';
const HISTORY = 100;

export default function Pad() {
  const mounted = useMounted();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [undo, setUndo] = useState<Grid[]>([]);
  const [redo, setRedo] = useState<Grid[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(1);
  const [mirror, setMirror] = useState(true);
  const [lines, setLines] = useState(true);
  const drawing = useRef(false);

  // Load the saved drawing, or start from today's critter.
  useEffect(() => {
    let saved: Grid | null = null;
    try {
      saved = decodeGrid(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* storage blocked */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading client-only state
    setGrid(saved ?? starterGrid(hash(isoDate())));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, encodeGrid(grid));
      } catch {
        /* storage full or blocked */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [grid, mounted]);

  // Render the grid at 16 device pixels per cell, with optional grid lines.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const s = PAD_SIZE * CELL;
    canvas.width = s;
    canvas.height = s;
    for (let y = 0; y < PAD_SIZE; y++) {
      for (let x = 0; x < PAD_SIZE; x++) {
        const v = grid[y * PAD_SIZE + x] ?? 0;
        ctx.fillStyle = v
          ? (PAD_COLORS[v]?.value ?? PALETTE.ink)
          : (x + y) % 2
            ? '#ffffff'
            : '#f1eee4';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    if (lines) {
      ctx.fillStyle = 'rgba(18, 18, 18, 0.12)';
      for (let i = 1; i < PAD_SIZE; i++) {
        ctx.fillRect(i * CELL, 0, 1, s);
        ctx.fillRect(0, i * CELL, s, 1);
      }
      if (mirror) {
        ctx.fillStyle = 'rgba(31, 157, 85, 0.6)';
        ctx.fillRect(s / 2 - 1, 0, 2, s);
      }
    }
  }, [grid, lines, mirror]);

  const commit = useCallback((next: Grid, prev: Grid) => {
    if (next === prev) return;
    setUndo((u) => [...u.slice(-HISTORY + 1), prev]);
    setRedo([]);
    setGrid(next);
  }, []);

  const cellFrom = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.floor(((e.clientX - r.left) / r.width) * PAD_SIZE),
      Math.floor(((e.clientY - r.top) / r.height) * PAD_SIZE),
    ] as const;
  };

  const ink = tool === 'eraser' ? 0 : color;

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = cellFrom(e);
    if (tool === 'fill') {
      commit(fill(grid, x, y, ink), grid);
      return;
    }
    drawing.current = true;
    commit(paint(grid, x, y, ink, mirror), grid);
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const [x, y] = cellFrom(e);
    // Strokes extend the current history entry instead of adding new ones.
    setGrid((g) => paint(g, x, y, ink, mirror));
  };

  const onUp = () => {
    drawing.current = false;
  };

  const doUndo = useCallback(() => {
    const prev = undo.at(-1);
    if (!prev) return;
    setUndo(undo.slice(0, -1));
    setRedo([...redo, grid]);
    setGrid(prev);
  }, [undo, redo, grid]);

  const doRedo = useCallback(() => {
    const next = redo.at(-1);
    if (!next) return;
    setRedo(redo.slice(0, -1));
    setUndo([...undo, grid]);
    setGrid(next);
  }, [undo, redo, grid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (!mod) {
        if (e.key === 'b') setTool('pen');
        else if (e.key === 'e') setTool('eraser');
        else if (e.key === 'g') setTool('fill');
        else if (e.key === 'm') setMirror((m) => !m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo]);

  const exportPng = () => {
    const out = document.createElement('canvas');
    out.width = PAD_SIZE * 16;
    out.height = PAD_SIZE * 16;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    grid.forEach((v, i) => {
      if (!v) return;
      ctx.fillStyle = PAD_COLORS[v]?.value ?? PALETTE.ink;
      ctx.fillRect((i % PAD_SIZE) * 16, Math.floor(i / PAD_SIZE) * 16, 16, 16);
    });
    downloadCanvas(out, 'shiqi-pixel.png');
  };

  const exportSvg = () =>
    downloadBlob(new Blob([toSvg(grid)], { type: 'image/svg+xml' }), 'shiqi-pixel.svg');

  return (
    <PageWindow
      file="play/pad"
      eyebrow="PIXEL PAD"
      title="像素画板"
      lede="32×32，九种颜色，默认左右镜像。今天的小怪已经替你起了个头。画的东西自动保存在这个浏览器里。"
    >
      <div className="stage">
        <div className="stage__canvas">
          <canvas
            ref={canvasRef}
            className="ui-canvas ui-canvas--framed pad-canvas"
            aria-label="像素画布，用鼠标或手指绘制"
            role="img"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
        <Card padded className="stage__panel">
          <Stack gap={4}>
            <Segmented
              label="工具"
              value={tool}
              onChange={setTool}
              options={[
                { value: 'pen', label: '笔' },
                { value: 'eraser', label: '橡皮' },
                { value: 'fill', label: '填充' },
              ]}
            />
            <div className="ui-field">
              <span className="ui-field__label">颜色</span>
              <Swatches
                label="颜色"
                value={String(color)}
                onChange={(v) => {
                  setColor(Number(v));
                  if (tool === 'eraser') setTool('pen');
                }}
                colors={PAD_COLORS.slice(1).map((c, i) => ({
                  value: String(i + 1),
                  name: c.name,
                  css: c.value,
                }))}
              />
            </div>
            <Checkbox
              label="左右镜像"
              checked={mirror}
              onChange={(e) => setMirror(e.target.checked)}
            />
            <Checkbox
              label="显示网格"
              checked={lines}
              onChange={(e) => setLines(e.target.checked)}
            />
            <Cluster>
              <Button variant="secondary" size="sm" onClick={doUndo} disabled={!undo.length}>
                撤销
              </Button>
              <Button variant="secondary" size="sm" onClick={doRedo} disabled={!redo.length}>
                重做
              </Button>
              <Button variant="ghost" size="sm" onClick={() => commit(emptyGrid(), grid)}>
                清空
              </Button>
            </Cluster>
            <Cluster>
              <Button onClick={exportPng}>导出 PNG</Button>
              <Button variant="secondary" onClick={exportSvg}>
                导出 SVG
              </Button>
            </Cluster>
            <p className="ui-field__hint">
              <Kbd>B</Kbd> 笔 · <Kbd>E</Kbd> 橡皮 · <Kbd>G</Kbd> 填充 · <Kbd>M</Kbd> 镜像 ·{' '}
              <Kbd>⌘Z</Kbd> 撤销
            </p>
          </Stack>
        </Card>
      </div>
    </PageWindow>
  );
}
