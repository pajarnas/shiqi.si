import { useEffect, useImperativeHandle, useRef, type CanvasHTMLAttributes, type Ref } from 'react';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { cx } from '../cx';

export interface DrawFrame {
  ctx: CanvasRenderingContext2D;
  /** Canvas size in canvas pixels. */
  w: number;
  h: number;
  /** Canvas pixels per CSS pixel. */
  scale: number;
  /** Seconds since the animation started; 0 for stills. */
  t: number;
}

export interface PixelCanvasProps extends Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  'width' | 'height'
> {
  /** Draw callback. Called again whenever it changes identity, so wrap it in useCallback. */
  draw: (frame: DrawFrame) => void;
  /** Fixed resolution in canvas pixels. CSS scales it; edges stay hard. */
  width?: number;
  height?: number;
  /**
   * Instead of a fixed size, follow the element's CSS size times `resolution`.
   * Use 'device' for crisp output at devicePixelRatio, or a number below 1 for chunky pixels.
   */
  resolution?: number | 'device';
  /** Run a frame loop. Pauses offscreen, in background tabs and under reduced motion. */
  animate?: boolean;
  /** Frame cap for the loop. Default 30. */
  fps?: number;
  /** Accessible description. Omit for decorative canvases. */
  label?: string;
  framed?: boolean;
  canvasRef?: Ref<HTMLCanvasElement>;
}

export function PixelCanvas({
  draw,
  width,
  height,
  resolution,
  animate = false,
  fps = 30,
  label,
  framed,
  className,
  canvasRef,
  ...rest
}: PixelCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const reduced = useReducedMotion();
  const running = animate && !reduced;

  useImperativeHandle(canvasRef, () => ref.current as HTMLCanvasElement, []);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let scale = 1;
    let raf = 0;
    let last = 0;
    let start = performance.now();
    let visible = true;

    const resize = () => {
      if (resolution === undefined) {
        canvas.width = width ?? 64;
        canvas.height = height ?? 64;
        scale = canvas.width / Math.max(1, canvas.clientWidth);
        return;
      }
      scale = resolution === 'device' ? window.devicePixelRatio || 1 : resolution;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    };

    const paint = (t: number) => {
      ctx.imageSmoothingEnabled = false;
      drawRef.current({ ctx, w: canvas.width, h: canvas.height, scale, t });
    };

    resize();
    paint(0);

    const ro = new ResizeObserver(() => {
      resize();
      paint(last);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && running) loop();
    });
    io.observe(canvas);

    const loop = () => {
      cancelAnimationFrame(raf);
      let prev = 0;
      const tick = (now: number) => {
        if (!visible || document.hidden) return;
        if (now - prev >= 1000 / fps) {
          prev = now;
          last = (now - start) / 1000;
          paint(last);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (!document.hidden && running && visible) loop();
    };
    if (running) {
      start = performance.now();
      loop();
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [width, height, resolution, running, fps]);

  // Redraw stills when the draw callback changes.
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || running) return;
    ctx.imageSmoothingEnabled = false;
    draw({
      ctx,
      w: canvas.width,
      h: canvas.height,
      scale: canvas.width / Math.max(1, canvas.clientWidth),
      t: 0,
    });
  }, [draw, running]);

  return (
    <canvas
      ref={ref}
      className={cx('ui-canvas', framed && 'ui-canvas--framed', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    />
  );
}
