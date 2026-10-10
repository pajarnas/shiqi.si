// The translation service. Turns English strings (plain text or HTML) into
// another locale with a free machine-translation service, and caches every
// result in Redis by content hash, so each string is translated once and edits
// to the English re-translate only what changed.
//
// Providers, picked by which env vars are set:
//   AZURE_TRANSLATOR_KEY (+ AZURE_TRANSLATOR_REGION unless the resource is global)
//     Azure AI Translator, free tier F0: 2 million characters a month.
//   LIBRETRANSLATE_URL (+ LIBRETRANSLATE_KEY if the server needs one)
//     LibreTranslate, open source; free when self-hosted.
// With neither, translation is off and pages fall back to English.
import { createHash } from 'node:crypto';
import { cacheGet, cacheSet } from '~/lib/cache.server';
import { LANGUAGES, type Locale } from './locales';

export type TextFormat = 'text' | 'html';

const TTL = 180 * 24 * 3600;
const MAX_BATCH_CHARS = 12_000;
const MAX_BATCH_ITEMS = 100;

interface Provider {
  id: string;
  translate(texts: string[], target: Locale, format: TextFormat): Promise<string[]>;
}

function pickProvider(): Provider | null {
  const env = process.env;
  if (env.AZURE_TRANSLATOR_KEY) return azure(env.AZURE_TRANSLATOR_KEY, env.AZURE_TRANSLATOR_REGION);
  if (env.LIBRETRANSLATE_URL) return libre(env.LIBRETRANSLATE_URL, env.LIBRETRANSLATE_KEY);
  return null;
}

let provider: Provider | null | undefined;
const getProvider = () => (provider === undefined ? (provider = pickProvider()) : provider);

export const translationEnabled = () => getProvider() !== null;

const cacheKey = (target: Locale, format: TextFormat, text: string) =>
  `tr:v2:${getProvider()?.id}:${target}:${format}:${createHash('sha256').update(text).digest('hex').slice(0, 32)}`;

/** Translations already being fetched, so concurrent requests share one call. */
const inflight = new Map<string, Promise<string | null>>();

/**
 * Translate English `texts` into `target`. Returns one entry per input, in
 * order; an entry is null when it couldn't be translated (service off or failed).
 */
export async function translateTexts(
  texts: string[],
  target: Locale,
  format: TextFormat = 'text',
): Promise<(string | null)[]> {
  if (target === 'en') return texts;
  const keys = texts.map((t) => cacheKey(target, format, t));
  const cached = await cacheGet(keys);
  const out: (string | null)[] = cached.map((c) => c ?? null);

  const todo = new Map<string, string>();
  texts.forEach((text, i) => {
    const key = keys[i] as string;
    if (out[i] === null && !inflight.has(key)) todo.set(key, text);
  });

  if (todo.size && getProvider()) {
    const entries = [...todo];
    const done = callInBatches(entries, target, format);
    entries.forEach(([key], i) => {
      const p = done.then((r) => r[i] ?? null);
      inflight.set(key, p);
      void p.finally(() => inflight.delete(key));
    });
  }

  await Promise.all(
    keys.map(async (key, i) => {
      if (out[i] === null) out[i] = (await inflight.get(key)) ?? null;
    }),
  );
  return out;
}

async function callInBatches(
  entries: [string, string][],
  target: Locale,
  format: TextFormat,
): Promise<(string | null)[]> {
  const batches: [string, string][][] = [[]];
  let size = 0;
  for (const e of entries) {
    const current = batches.at(-1) as [string, string][];
    if (
      current.length &&
      (size + e[1].length > MAX_BATCH_CHARS || current.length >= MAX_BATCH_ITEMS)
    ) {
      batches.push([e]);
      size = e[1].length;
    } else {
      current.push(e);
      size += e[1].length;
    }
  }
  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const translated = await translateBatch(
          batch.map(([, t]) => t),
          target,
          format,
        );
        await cacheSet(
          batch.map(([key], i) => [key, translated[i] as string]),
          TTL,
        );
        return translated;
      } catch (err) {
        console.error('[translate] failed', err instanceof Error ? err.message : err);
        return batch.map(() => null);
      }
    }),
  );
  return results.flat();
}

async function translateBatch(
  texts: string[],
  target: Locale,
  format: TextFormat,
): Promise<string[]> {
  const p = getProvider();
  if (!p) throw new Error('translation is not configured');
  // Plain strings go through as HTML too, so markup tags like <b> survive and
  // {placeholders} can be fenced off as untranslatable.
  const html = format === 'html' ? texts : texts.map(protect);
  const out = await p.translate(html, target, 'html');
  if (out.length !== texts.length) {
    throw new Error(`expected ${texts.length} translations, got ${out.length}`);
  }
  return format === 'html' ? out : out.map(unprotect);
}

const NO = '<span class="notranslate" translate="no">';

/** Escape a dictionary string for HTML mode and fence off its {placeholders}. */
export function protect(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/\{(\w+)\}/g, `${NO}{$1}</span>`);
}

export function unprotect(html: string): string {
  return html
    .replace(/<span class="notranslate" translate="no">\s*(\{\w+\})\s*<\/span>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const TIMEOUT_MS = 30_000;

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status} ${await res.text()}`);
  return res.json() as Promise<unknown>;
}

/** Azure AI Translator v3: https://learn.microsoft.com/azure/ai-services/translator/ */
function azure(key: string, region?: string): Provider {
  return {
    id: 'azure',
    async translate(texts, target, format) {
      const url = new URL(
        '/translate',
        process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com',
      );
      url.search = new URLSearchParams({
        'api-version': '3.0',
        from: 'en',
        to: LANGUAGES[target].azure,
        textType: format === 'html' ? 'html' : 'plain',
      }).toString();
      const headers: Record<string, string> = { 'Ocp-Apim-Subscription-Key': key };
      if (region) headers['Ocp-Apim-Subscription-Region'] = region;
      const body = (await postJson(
        url.toString(),
        texts.map((Text) => ({ Text })),
        headers,
      )) as { translations?: { text?: string }[] }[];
      return body.map((r) => {
        const text = r.translations?.[0]?.text;
        if (typeof text !== 'string') throw new Error('azure: unexpected response');
        return text;
      });
    },
  };
}

/** LibreTranslate: https://libretranslate.com/docs */
function libre(base: string, key?: string): Provider {
  return {
    id: 'libre',
    async translate(texts, target, format) {
      const body = (await postJson(new URL('/translate', base).toString(), {
        q: texts,
        source: 'en',
        target: LANGUAGES[target].libre,
        format: format === 'html' ? 'html' : 'text',
        ...(key ? { api_key: key } : {}),
      })) as { translatedText?: unknown };
      const out = body.translatedText;
      if (!Array.isArray(out) || out.some((t) => typeof t !== 'string')) {
        throw new Error('libretranslate: unexpected response');
      }
      return out as string[];
    },
  };
}

/** Resolve to `fallback` if `p` takes longer than `ms`; `p` keeps running (and caching). */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms).unref?.())]);
}
