// The share-ready verdict card: a PNG drawn in the browser from a judgment, in the formats the
// marketing plan posts (3:4 for Xiaohongshu, 9:16 for Douyin and TikTok). Nothing leaves the page.

export const CARD_SIZES = {
  portrait: { w: 1080, h: 1440 },
  story: { w: 1080, h: 1920 },
} as const;
export type CardSize = keyof typeof CARD_SIZES;

export interface CardData {
  brand: string;
  eyebrow: string;
  title: string;
  judge: string;
  catchphrase: string;
  ruling: string;
  outcome?: string;
  plaintiff: string;
  defendant: string;
  /** Plaintiff's share of blame, 0–100. */
  respA: number;
  findingsLabel: string;
  /** At most three are drawn. */
  findings: string[];
  makeupLabel: string;
  makeup: string;
  codeLabel: string;
  code: string;
  aiLabel: string;
  demoLabel: string;
  site: string;
  sealSrc: string;
  sealText: string;
}

/** Used when a caller passes an empty label: a card never leaves without saying it is AI-made. */
export const AI_LABEL_DEFAULT = 'AI 生成·仅供娱乐';
export const DEMO_LABEL_DEFAULT = '网页演示';

/** The corner labels as drawn, with the fallbacks applied. */
export const cardLabels = (data: Pick<CardData, 'aiLabel' | 'demoLabel'>) => ({
  ai: data.aiLabel.trim() || AI_LABEL_DEFAULT,
  demo: data.demoLabel.trim() || DEMO_LABEL_DEFAULT,
});

/** The case title is user text: at most this many lines, the last one cut with an ellipsis. */
export const TITLE_MAX_LINES = 2;

const INK = '#1a1a1a';
const PAPER = '#fffaf0';
const PURPLE = '#7B5CFF';
const GOLD = '#FFC23D';
const BLUE = '#3B82F6';
const PINK = '#EC4899';
const RED = '#C8102E';
const FONT =
  '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "WenQuanYi Zen Hei", system-ui, sans-serif';

// One CJK character, a run of other non-space characters, or a run of spaces.
const TOKENS = new RegExp(
  '[\\u3000-\\u9fff\\uff00-\\uffef]|[^\\s\\u3000-\\u9fff\\uff00-\\uffef]+|\\s+',
  'g',
);

/** Punctuation that must not start a line; it stays on the previous one. */
const CLOSING = /^[，。、；：？！）」』》”’,.;:?!)]$/;

/**
 * Breaks text into lines no wider than `max`. Splits on spaces for words, and between any two
 * characters for CJK, so Chinese wraps without spaces.
 */
export function wrapText(text: string, max: number, measure: (s: string) => number): string[] {
  const tokens = text.match(TOKENS) ?? [];
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    const next = line + tok;
    if (line && measure(next.trimEnd()) > max && !CLOSING.test(tok)) {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/** Keeps the first `n` lines, cutting the last kept line so it ends in "…" within `max`. */
export function clampLines(
  lines: string[],
  n: number,
  max: number,
  measure: (s: string) => number,
): string[] {
  if (lines.length <= n) return lines;
  const kept = lines.slice(0, n);
  let last = Array.from(kept[n - 1] ?? '');
  while (last.length && measure(`${last.join('').trimEnd()}…`) > max) last = last.slice(0, -1);
  kept[n - 1] = `${last.join('').trimEnd()}…`;
  return kept;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Draws the card and returns it as a PNG blob. */
export async function renderCard(data: CardData, size: CardSize): Promise<Blob> {
  const { w, h } = CARD_SIZES[size];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const pad = 72;
  const inner = w - pad * 2;
  // Text wraps one glyph short of the edge, so closing punctuation that hangs at the end of a
  // line still stays inside the paper.
  const textMax = inner - 40;
  const font = (px: number, weight = 400) => `${weight} ${px}px ${FONT}`;
  let dry = false;
  const text = (s: string, x: number, y: number, px: number, color = INK, weight = 400) => {
    ctx.font = font(px, weight);
    if (dry) return;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  };
  const para = (
    s: string,
    y: number,
    px: number,
    color = INK,
    weight = 400,
    lh = 1.45,
    maxLines = Infinity,
  ) => {
    ctx.font = font(px, weight);
    const measure = (t: string) => ctx.measureText(t).width;
    const lines = clampLines(wrapText(s, textMax, measure), maxLines, textMax, measure);
    for (const l of lines) {
      text(l, pad, y, px, color, weight);
      y += px * lh;
    }
    return y;
  };

  // Paper with a hard shadow, in the site's pixel style.
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.fillRect(40, 40, w - 64, h - 64);
  ctx.fillStyle = PAPER;
  ctx.fillRect(24, 24, w - 64, h - 64);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, w - 64, h - 64);
  ctx.textBaseline = 'top';

  // Corner labels: always on, so a card never travels without saying what it is.
  ctx.font = font(26, 700);
  const tag = (s: string, x: number, y: number, bg: string, fg: string) => {
    const tw = ctx.measureText(s).width + 28;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, tw, 44);
    ctx.fillStyle = fg;
    ctx.fillText(s, x + 14, y + 9);
    return tw;
  };
  const labels = cardLabels(data);
  const t1 = tag(labels.ai, pad, pad, INK, '#fff');
  tag(labels.demo, pad + t1 + 12, pad, PURPLE, '#fff');

  // Brand and case number sit right under the labels on every size.
  text(data.brand, pad, pad + 84, 30, PURPLE, 700);
  text(data.eyebrow, pad, pad + 132, 28, '#666');

  // The body is laid out twice: once dry to measure it, then for real. Findings are dropped
  // from the end until it fits above the footer, and a tall card centres what is left.
  const footY = h - pad - 220;
  const limit = footY - 56;
  const top = pad + 188;
  const drawBody = (y: number, nFindings: number): number => {
    y = para(data.title, y, 64, INK, 800, 1.2, TITLE_MAX_LINES) + 20;
    y = para(`${data.judge} · “${data.catchphrase}”`, y, 32, '#444') + 28;

    if (!dry) {
      ctx.fillStyle = GOLD;
      ctx.fillRect(pad, y, inner, 6);
    }
    y += 36;
    y = para(data.ruling, y, 52, INK, 800, 1.3) + 12;
    if (data.outcome) y = para(data.outcome, y, 32, PURPLE, 700) + 8;

    // Blame bar, percentages only in the bar, names underneath.
    y += 16;
    const barH = 64;
    const aW = Math.round((inner * data.respA) / 100);
    if (!dry) {
      ctx.fillStyle = BLUE;
      ctx.fillRect(pad, y, aW, barH);
      ctx.fillStyle = PINK;
      ctx.fillRect(pad + aW, y, inner - aW, barH);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeRect(pad, y, inner, barH);
    }
    text(`${data.respA}%`, pad + 18, y + 14, 34, '#fff', 800);
    ctx.font = font(34, 800);
    const bPct = `${100 - data.respA}%`;
    text(bPct, pad + inner - 18 - ctx.measureText(bPct).width, y + 14, 34, '#fff', 800);
    y += barH + 14;
    text(data.plaintiff, pad, y, 28, BLUE, 700);
    ctx.font = font(28, 700);
    text(data.defendant, pad + inner - ctx.measureText(data.defendant).width, y, 28, PINK, 700);
    y += 64;

    if (nFindings > 0) {
      text(data.findingsLabel, pad, y, 30, '#666', 700);
      y += 46;
      for (const f of data.findings.slice(0, nFindings)) y = para(`· ${f}`, y, 32, '#333') + 6;
      y += 28;
    }
    text(data.makeupLabel, pad, y, 30, '#666', 700);
    y += 46;
    y = para(data.makeup, y, 36);
    return y;
  };
  let n = Math.min(3, data.findings.length);
  dry = true;
  while (n > 0 && drawBody(top, n) > limit) n--;
  const offset = Math.max(0, Math.floor((limit - drawBody(top, n)) / 2));
  dry = false;
  drawBody(top + (size === 'story' ? offset : 0), n);

  // Footer: anti-forgery code on the left, the judge's seal on the right.
  ctx.fillStyle = INK;
  ctx.fillRect(pad, footY - 24, inner, 4);
  text(data.codeLabel, pad, footY + 10, 26, '#666');
  text(data.code, pad, footY + 50, 44, INK, 800);
  text(data.site, pad, footY + 130, 30, PURPLE, 700);
  const seal = await loadImage(data.sealSrc);
  const sealSize = 220;
  const sx = w - pad - sealSize - 8;
  const sy = footY - 10;
  if (seal) {
    ctx.drawImage(seal, sx, sy, sealSize, sealSize);
  } else {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(sx + sealSize / 2, sy + sealSize / 2, sealSize / 2 - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = font(36, 800);
    ctx.fillStyle = RED;
    const tw = ctx.measureText(data.sealText).width;
    ctx.fillText(data.sealText, sx + (sealSize - tw) / 2, sy + sealSize / 2 - 20);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

/** Saves a blob as a file through a temporary link. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
