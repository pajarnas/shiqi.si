// Colour parsing and conversion: sRGB in, HEX / RGB / HSL / OKLCH out.

export interface Rgba {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() and hsl()/hsla(), comma or space syntax. */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex?.[1]) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = s.match(/^(rgba?|hsla?)\((.+)\)$/);
  if (!fn?.[1] || !fn[2]) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const num = (p: string, scale: number) =>
    p.endsWith('%') ? (parseFloat(p) / 100) * scale : parseFloat(p);
  const alpha = parts[3] === undefined ? 1 : num(parts[3], 1);
  const [p0, p1, p2] = parts as [string, string, string];
  if (fn[1].startsWith('rgb')) {
    const [r, g, b] = [p0, p1, p2].map((p) => num(p, 255));
    if ([r, g, b, alpha].some((v) => v === undefined || Number.isNaN(v))) return null;
    return {
      r: clamp(Math.round(r!), 0, 255),
      g: clamp(Math.round(g!), 0, 255),
      b: clamp(Math.round(b!), 0, 255),
      a: clamp(alpha, 0, 1),
    };
  }
  const h = parseFloat(p0);
  const sat = num(p1, 1);
  const light = num(p2, 1);
  if ([h, sat, light, alpha].some(Number.isNaN)) return null;
  return { ...hslToRgb(h, clamp(sat, 0, 1), clamp(light, 0, 1)), a: clamp(alpha, 0, 1) };
}

export function hslToRgb(h: number, s: number, l: number): Omit<Rgba, 'a'> {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function rgbToHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** OKLCH per Björn Ottosson's OKLab. L in 0-1, C unbounded (~0-0.4), H in degrees. */
export function rgbToOklch(c: Rgba): { l: number; c: number; h: number } {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const b = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: L, c: C, h: C < 1e-4 ? 0 : H };
}

/** WCAG 2.x relative luminance. */
export function luminance(c: Rgba): number {
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

/** WCAG 2.x contrast ratio, 1-21. Alpha is ignored. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const r2 = (n: number, d = 2) => Number(n.toFixed(d));

export function formatColor(c: Rgba) {
  const hex =
    '#' +
    [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('') +
    (c.a < 1
      ? Math.round(c.a * 255)
          .toString(16)
          .padStart(2, '0')
      : '');
  const alpha = c.a < 1 ? ` / ${r2(c.a)}` : '';
  const hsl = rgbToHsl(c);
  const ok = rgbToOklch(c);
  return {
    hex,
    rgb: `rgb(${c.r} ${c.g} ${c.b}${alpha})`,
    hsl: `hsl(${r2(hsl.h, 1)} ${r2(hsl.s * 100, 1)}% ${r2(hsl.l * 100, 1)}%${alpha})`,
    oklch: `oklch(${r2(ok.l * 100, 2)}% ${r2(ok.c, 4)} ${r2(ok.h, 2)}${alpha})`,
  };
}

export function wcagLevels(ratio: number) {
  return {
    normalAA: ratio >= 4.5,
    normalAAA: ratio >= 7,
    largeAA: ratio >= 3,
    largeAAA: ratio >= 4.5,
  };
}
