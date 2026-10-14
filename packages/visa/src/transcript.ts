// The conversation as the family member saw it, rebuilt from what was sent to
// the API. Browser-safe: type imports only.
import type { Anthropic } from '@anthropic-ai/sdk';

type MessageParam = Anthropic.Beta.BetaMessageParam;

/** Marks the per-turn form state prepended to each user turn, so the chat view can hide it. */
export const STATE_TAG = '<form_state>';

export interface ChatLine {
  role: 'user' | 'assistant';
  text: string;
}

/** The conversation as the family member saw it: no form state, tool calls or results. */
export function transcript(messages: readonly MessageParam[]): ChatLine[] {
  const lines: ChatLine[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'system') return;
    if (typeof m.content === 'string') {
      if (m.content.trim()) lines.push({ role: m.role, text: m.content });
      return;
    }
    const text = m.content
      .filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === 'text')
      .map((b) => b.text)
      .filter(
        (t) => !t.startsWith(STATE_TAG) && !(i === 0 && m.role === 'user' && t.startsWith('（')),
      )
      .join('\n\n')
      .trim();
    if (!text) return;
    const last = lines.at(-1);
    if (last && last.role === m.role) last.text += `\n\n${text}`;
    else lines.push({ role: m.role, text });
  });
  return lines;
}
