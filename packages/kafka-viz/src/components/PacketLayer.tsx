import type { Cluster, ClusterEvent } from '@shiqi/kafka';
import { useEffect, useRef, type RefObject } from 'react';
import { anchorId, type AnchorRegistry } from '../anchors';
import { KEY_COLORS, keySlot } from '../keys';

interface Packet {
  from: string;
  to: string;
  born: number;
  duration: number;
  /** CSS colour slot: key index, or 'none' / 'error' / 'replica'. */
  color: number | 'none' | 'error' | 'replica' | 'consume';
  size: number;
}

const MAX_PACKETS = 260;
const BASE_DURATION = 700;

function packetFor(e: ClusterEvent, c: Cluster): Omit<Packet, 'born' | 'duration'> | null {
  switch (e.type) {
    case 'produce': {
      const slot = keySlot(e.key);
      return {
        from: anchorId.producer(e.producer),
        to: anchorId.replica(e.topic, e.partition, e.broker),
        color: slot ?? 'none',
        size: 1,
      };
    }
    case 'replicate':
      return {
        from: anchorId.replica(e.topic, e.partition, e.from),
        to: anchorId.replica(e.topic, e.partition, e.to),
        color: 'replica',
        size: Math.min(3, e.count),
      };
    case 'consume':
      return {
        from: anchorId.replica(e.topic, e.partition, e.broker),
        to: anchorId.member(e.group, e.member),
        color: 'consume',
        size: Math.min(3, e.count),
      };
    case 'ack': {
      if (!e.error) return null;
      const p = c.topics.get(e.topic)?.partitions[e.partition];
      const target = p?.leader ?? p?.replicas[0];
      // A request that never left (no broker up to take it) flashes at the producer.
      const reachable = target !== undefined && c.brokers.get(target)?.up;
      return {
        from: anchorId.producer(e.producer),
        to:
          !reachable || target === undefined
            ? anchorId.producer(e.producer)
            : anchorId.replica(e.topic, e.partition, target),
        color: 'error',
        size: 1,
      };
    }
    default:
      return null;
  }
}

/** Point of an element relative to the stage: right/left edge facing the other end. */
function centre(el: HTMLElement, stage: DOMRect) {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - stage.left + r.width / 2,
    y: r.top - stage.top + r.height / 2,
    w: r.width,
    h: r.height,
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * A canvas over the stage where records fly as pixel squares: producer →
 * leader, leader → followers, leader → consumer. Colour is the record key.
 */
export function PacketLayer({
  cluster,
  anchors,
  stageRef,
  speed,
}: {
  cluster: Cluster;
  anchors: AnchorRegistry;
  stageRef: RefObject<HTMLElement | null>;
  speed: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packets = useRef<Packet[]>([]);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(
    () =>
      cluster.onEvent((e) => {
        const p = packetFor(e, cluster);
        if (!p || packets.current.length >= MAX_PACKETS) return;
        const duration = Math.max(160, Math.min(1400, BASE_DURATION / Math.sqrt(speedRef.current)));
        packets.current.push({ ...p, born: performance.now(), duration });
      }),
    [cluster],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let colors: Record<string, string> = {};
    let colorsAt = 0;
    const readColors = () => {
      const cs = getComputedStyle(stage);
      const v = (name: string) => cs.getPropertyValue(name).trim() || '#888';
      colors = {
        none: v('--kv-key-none'),
        error: v('--danger'),
        replica: v('--kv-replica'),
        consume: v('--kv-consume'),
        ink: v('--border'),
      };
      for (let i = 0; i < KEY_COLORS; i++) colors[i] = v(`--kv-key-${i}`);
    };

    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - colorsAt > 1000) {
        readColors();
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

      const cache = new Map<string, ReturnType<typeof centre> | null>();
      const where = (id: string) => {
        if (!cache.has(id)) {
          const el = anchors.get(id);
          cache.set(id, el ? centre(el, rect) : null);
        }
        return cache.get(id) ?? null;
      };

      const alive: Packet[] = [];
      for (const p of packets.current) {
        const t = (now - p.born) / p.duration;
        if (t >= 1) continue;
        alive.push(p);
        const a = where(p.from);
        const b = where(p.to);
        if (!a || !b) continue;
        const color = colors[p.color] ?? colors.none ?? '#888';
        const ink = colors.ink ?? '#111';
        const sq = 6 + p.size * 2;
        // Arc upward between two rows of the same column, straight otherwise.
        const lift = Math.abs(a.x - b.x) < 40 ? Math.min(60, Math.abs(a.y - b.y) / 2 + 20) : 0;
        const steps = reduced.matches ? [1] : [0.12, 0.06, 0];
        steps.forEach((lag, i) => {
          const k = easeInOut(Math.max(0, t - lag));
          const x = a.x + (b.x - a.x) * k + (lift ? lift * Math.sin(Math.PI * k) : 0);
          const y = a.y + (b.y - a.y) * k;
          const s = i === steps.length - 1 ? sq : sq * (0.5 + i * 0.15);
          ctx.globalAlpha = i === steps.length - 1 ? 1 : 0.35;
          ctx.fillStyle = ink;
          ctx.fillRect(Math.round(x - s / 2) - 1, Math.round(y - s / 2) - 1, s + 2, s + 2);
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
        });
        ctx.globalAlpha = 1;
      }
      packets.current = alive;
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [anchors, stageRef]);

  return <canvas ref={canvasRef} className="kv-packets" aria-hidden="true" />;
}
