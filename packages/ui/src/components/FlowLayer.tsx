import { useEffect, useImperativeHandle, useRef, type Ref, type RefObject } from 'react';

/** Elements things fly between, by id. Cards register themselves with `anchorRef`. */
export type AnchorRegistry = Map<string, HTMLElement>;

/** A ref callback that keeps `registry` up to date for `id`. */
export function anchorRef(registry: AnchorRegistry, id: string) {
  return (el: HTMLElement | null) => {
    if (el) registry.set(id, el);
    else registry.delete(id);
  };
}

/**
 * Each kind of traffic has its own shape, so colour never carries it alone:
 * a solid square, a hollow square, a round dot, a crossed square.
 */
export type PacketShape = 'square' | 'hollow' | 'dot' | 'cross';

export interface FlowPacket {
  from: string;
  to: string;
  /** A CSS custom property holding the colour, e.g. '--rv-key-0'. */
  color: string;
  shape?: PacketShape;
  /** 1–3: how big the square is. */
  size?: number;
  /** How long the flight lasts, in real ms. */
  duration: number;
}

export interface FlowLink {
  from: string;
  to: string;
  /** A CSS custom property holding the colour. */
  color: string;
  dashed?: boolean;
  /** A few words drawn at the middle of the line (a binding key). */
  label?: string;
  /** Hovering any of these elements brings the line forward and fades the others. */
  hotWith?: string[];
}

export interface FlowLayerHandle {
  send(p: FlowPacket): void;
}

export interface FlowLayerProps {
  anchors: AnchorRegistry;
  /** The element the canvas covers; anchor positions are relative to it. */
  stageRef: RefObject<HTMLElement | null>;
  /** The lines to draw, read every frame. */
  links?: () => FlowLink[];
  className?: string;
  ref?: Ref<FlowLayerHandle>;
}

const MAX_PACKETS = 260;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function box(el: HTMLElement, stage: DOMRect): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left - stage.left + r.width / 2, y: r.top - stage.top + r.height / 2, w: r.width, h: r.height };
}

/** The two facing edges of boxes a and b, so a line between them doesn't cross either. */
export function facingEdges(a: Box, b: Box) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = Math.sign(dx) || 1;
    return [a.x + (s * a.w) / 2, a.y, b.x - (s * b.w) / 2, b.y] as const;
  }
  const s = Math.sign(dy) || 1;
  return [a.x, a.y + (s * a.h) / 2, b.x, b.y - (s * b.h) / 2] as const;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function drawPacket(
  ctx: CanvasRenderingContext2D,
  shape: PacketShape,
  x: number,
  y: number,
  s: number,
  color: string,
  ink: string,
) {
  ctx.fillStyle = ink;
  if (shape === 'dot') {
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);
  if (shape === 'hollow') {
    const b = Math.max(2, Math.round(s / 4));
    ctx.fillStyle = ink;
    ctx.fillRect(x + b, y + b, s - 2 * b, s - 2 * b);
  } else if (shape === 'cross') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 1);
    ctx.lineTo(x + s - 1, y + s - 1);
    ctx.moveTo(x + s - 1, y + 1);
    ctx.lineTo(x + 1, y + s - 1);
    ctx.stroke();
  }
}

interface Flying extends FlowPacket {
  born: number;
}

/**
 * A canvas over a stage of cards: lines between them, and pixel packets that
 * fly from one card to another. Anchors are looked up every frame, so cards
 * can move, wrap or scroll. Respects prefers-reduced-motion (no trails).
 */
export function FlowLayer({ anchors, stageRef, links, className, ref }: FlowLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packets = useRef<Flying[]>([]);
  const linksRef = useRef(links);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  useImperativeHandle(ref, () => ({
    send: (p) => {
      if (packets.current.length < MAX_PACKETS)
        packets.current.push({ ...p, born: performance.now() });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const colors = new Map<string, string>();
    let colorsAt = 0;
    const color = (name: string) => {
      let c = colors.get(name);
      if (c === undefined) {
        c = getComputedStyle(stage).getPropertyValue(name).trim() || '#888';
        colors.set(name, c);
      }
      return c;
    };

    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      // Themes change the colours: read them again now and then.
      if (now - colorsAt > 1000) {
        colors.clear();
        colorsAt = now;
      }
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const cache = new Map<string, Box | null>();
      const where = (id: string) => {
        if (!cache.has(id)) {
          const el = anchors.get(id);
          cache.set(id, el && el.offsetParent !== null ? box(el, rect) : null);
        }
        return cache.get(id) ?? null;
      };
      const ink = color('--border');
      const text = color('--text');
      const surface = color('--surface');

      const lines = linksRef.current?.() ?? [];
      const hovered = (id: string) => anchors.get(id)?.matches(':hover') ?? false;
      const hot = lines.map((l) => (l.hotWith ?? [l.from, l.to]).some(hovered));
      const anyHot = hot.some(Boolean);
      ctx.save();
      ctx.font = '11px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      lines.forEach((l, i) => {
        const a = where(l.from);
        const b = where(l.to);
        if (!a || !b) return;
        const [x1, y1, x2, y2] = facingEdges(a, b);
        ctx.globalAlpha = hot[i] ? 1 : anyHot ? 0.12 : 0.6;
        ctx.strokeStyle = color(l.color);
        ctx.lineWidth = hot[i] ? 2.5 : 1.5;
        ctx.setLineDash(l.dashed ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (l.label) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const tw = ctx.measureText(l.label).width + 8;
          ctx.setLineDash([]);
          ctx.fillStyle = surface;
          ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
          ctx.strokeStyle = color(l.color);
          ctx.lineWidth = 1;
          ctx.strokeRect(mx - tw / 2, my - 8, tw, 16);
          ctx.fillStyle = text;
          ctx.fillText(l.label, mx, my + 1);
        }
      });
      ctx.restore();

      const alive: Flying[] = [];
      for (const p of packets.current) {
        const t = (now - p.born) / p.duration;
        if (t >= 1) continue;
        alive.push(p);
        const a = where(p.from);
        const b = where(p.to);
        if (!a || !b) continue;
        const fill = color(p.color);
        const sq = 6 + (p.size ?? 1) * 2;
        // Arc sideways between two rows of the same column, straight otherwise.
        const lift = Math.abs(a.x - b.x) < 40 ? Math.min(60, Math.abs(a.y - b.y) / 2 + 20) : 0;
        const steps = reduced.matches ? [0] : [0.12, 0.06, 0];
        steps.forEach((lag, i) => {
          const k = easeInOut(Math.max(0, t - lag));
          const x = a.x + (b.x - a.x) * k + (lift ? lift * Math.sin(Math.PI * k) : 0);
          const y = a.y + (b.y - a.y) * k;
          const s = i === steps.length - 1 ? sq : sq * (0.5 + i * 0.15);
          ctx.globalAlpha = i === steps.length - 1 ? 1 : 0.35;
          drawPacket(ctx, p.shape ?? 'square', Math.round(x - s / 2), Math.round(y - s / 2), s, fill, ink);
        });
        ctx.globalAlpha = 1;
      }
      packets.current = alive;
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [anchors, stageRef]);

  return <canvas ref={canvasRef} className={className ?? 'ui-flow'} aria-hidden="true" />;
}
