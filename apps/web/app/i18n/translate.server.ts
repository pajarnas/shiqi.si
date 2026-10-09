// The translation service. Turns English strings (plain text or HTML) into
// another locale with Claude, and caches every result in Redis by content hash,
// so each string is translated once and edits to the English re-translate only
// what changed.
//
// Configure with env vars:
//   ANTHROPIC_API_KEY  required; without it translation is off and pages fall back to English
//   TRANSLATE_MODEL    optional, defaults to claude-opus-5-5
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { cacheGet, cacheSet } from '~/lib/cache.server';
import type { Locale } from './locales';

export type TextFormat = 'text' | 'html';

const TTL = 180 * 24 * 3600;
const MAX_BATCH_CHARS = 12_000;
const LANGUAGE: Record<Locale, string> = { en: 'English', zh: 'Simplified Chinese' };

let client: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (client === undefined) {
    client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ timeout: 120_000, maxRetries: 1 })
      : null;
  }
  return client;
}

export const translationEnabled = () => getClient() !== null;

const model = () => process.env.TRANSLATE_MODEL || 'claude-opus-5-5';

const cacheKey = (target: Locale, format: TextFormat, text: string) =>
  `tr:v1:${target}:${format}:${createHash('sha256').update(text).digest('hex').slice(0, 32)}`;

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

  if (todo.size && getClient()) {
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
    if (current.length && size + e[1].length > MAX_BATCH_CHARS) {
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
        const translated = await callModel(
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

function instructions(target: Locale, format: TextFormat): string {
  return [
    `You translate the personal website shiqi.si from English into ${LANGUAGE[target]}.`,
    'The site is a playful pixel-art sandbox by a programmer: toys, developer tools and study notes.',
    'Write natural, concise text a native reader would expect on such a site; keep the friendly tone.',
    'Keep unchanged: placeholders in braces like {name}, markup tags like <b>…</b> or <link>…</link> and the text structure around them, code, commands, file names, URLs, numbers, units, product and brand names (React, Redis, shiqi.si, …).',
    format === 'html'
      ? 'Each input is an HTML fragment. Translate only human-readable text and the alt/title attributes. Keep every tag, attribute and the content of <code> and <pre> exactly as it is.'
      : 'Each input is a short UI string or a sentence.',
    'Return {"translations": [...]} with exactly one translation per input, in the same order.',
  ].join('\n');
}

async function callModel(texts: string[], target: Locale, format: TextFormat): Promise<string[]> {
  const api = getClient();
  if (!api) throw new Error('translation is not configured');
  const message = await api.beta.messages
    .stream({
      model: model(),
      max_tokens: 64_000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { translations: { type: 'array', items: { type: 'string' } } },
            required: ['translations'],
            additionalProperties: false,
          },
        },
      },
      system: instructions(target, format),
      messages: [{ role: 'user', content: JSON.stringify({ inputs: texts }) }],
    })
    .finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('the model declined to translate');
  if (message.stop_reason === 'max_tokens') throw new Error('translation was cut off');
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const parsed = JSON.parse(text) as { translations?: unknown };
  const list = parsed.translations;
  if (
    !Array.isArray(list) ||
    list.length !== texts.length ||
    list.some((t) => typeof t !== 'string')
  ) {
    throw new Error(
      `expected ${texts.length} translations, got ${JSON.stringify(list)?.slice(0, 200)}`,
    );
  }
  return list as string[];
}

/** Resolve to `fallback` if `p` takes longer than `ms`; `p` keeps running (and caching). */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms).unref?.())]);
}
