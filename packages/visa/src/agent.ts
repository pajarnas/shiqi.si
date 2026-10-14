// The chat assistant that interviews one family member. Each turn sends the
// whole conversation (append-only, so prompt caching and thinking carry over)
// and lets Claude record answers through tools; nothing is saved from free text.
import Anthropic from '@anthropic-ai/sdk';
import type { ApplicantStatus, Profile } from './store';
import { ALL_FIELDS, missingFields, progress, SECTIONS, type Answers } from './schema';
import { STATE_TAG } from './transcript';
import { checkAnswers, crossCheck } from './validate';

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;
type Message = Anthropic.Beta.BetaMessage;
type MessageParam = Anthropic.Beta.BetaMessageParam;

/** Sends one request; in the app this is `(p) => client.beta.messages.create(p)`. */
export type CreateMessage = (params: Params) => Promise<Message>;

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** The real API: reads ANTHROPIC_API_KEY unless a key is given. */
export function anthropicCaller(apiKey?: string): CreateMessage {
  const client = new Anthropic({ apiKey });
  return (params) => client.beta.messages.create(params);
}
const MAX_STEPS = 8;

const APPLICANT_KEYS = ALL_FIELDS.filter((f) => f.section.scope === 'applicant').map((f) => f.key);

function questionList(): string {
  return SECTIONS.filter((s) => s.scope === 'applicant')
    .map((s) => {
      const lines = s.fields.map((f) => {
        const bits = [`- ${f.key} (${f.type}) — ${f.en} / ${f.zh}`];
        if (f.options) bits.push(`  options: ${f.options.join(' | ')}`);
        if (f.hint) bits.push(`  note: ${f.hint}`);
        if (f.when) bits.push('  asked only when it applies (see the missing list)');
        if (f.optional) bits.push('  optional');
        return bits.join('\n');
      });
      return `## ${s.en} / ${s.zh}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

export const SYSTEM_PROMPT = `You help a Chinese family prepare U.S. B1/B2 visitor visa applications (form DS-160). You are chatting with one family member on a private page their relative set up. Many are older parents who are not used to forms, so be warm, patient and plain.

How to talk:
- Write in simple Simplified Chinese. Short messages. Ask one or two things at a time, in the order of the list below, and say where to find the answer when it helps (e.g. 护照首页).
- Each user turn starts with a ${STATE_TAG} block: the answers saved so far, what is still missing and any warnings. Use it to decide what to ask next; the family member does not see it.
- When they answer, convert it to how it is typed into the DS-160: English, uppercase pinyin for names and places, dates as YYYY-MM-DD. Read conversions back to them in a few words (e.g. "张小明 → ZHANG XIAOMING") and fix anything they correct.
- Save every answer with the save_answers tool as soon as you have it. Save "NONE" for list questions they have nothing for. If the tool reports an error, ask again.
- Never guess or invent an answer. If they do not know, say their relative can fill it in later and move on.
- Security and background questions: explain what is being asked in plain words and let them answer. Never answer for them or hint at what to say. If anything is "yes", tell them their relative will go through it with them.
- This is not legal advice and you cannot submit anything. The relative who sent the link submits the form on ceac.state.gov. If asked about chances, fees or interviews, give general information and suggest asking that relative.
- If they wander off topic, answer briefly and come back to the form.
- When the missing list is empty, check with them that everything is right, then call finish_collection and tell them their relative will review it. They can still change answers on the review page.

Trip and U.S. contact details are filled in by the relative and are shared by the whole family; you do not need to ask them.

# Questions (DS-160 field key, type, wording)

${questionList()}`;

export const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: 'save_answers',
    description:
      'Saves one or more answers to the form. Values must already be in DS-160 format: English, uppercase pinyin for names and places, dates as YYYY-MM-DD, yesno as "yes"/"no", choice as one of the listed options, list as one item per line. Returns what was saved, any errors, cross-field warnings and the next questions still missing.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', enum: APPLICANT_KEYS },
              value: { type: 'string' },
            },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['answers'],
      additionalProperties: false,
    },
  },
  {
    name: 'finish_collection',
    description:
      'Marks the interview as finished and sends the answers to the relative for review. Call only after the missing list is empty and the family member confirmed the answers.',
    strict: true,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function formState(answers: Answers, caseAnswers: Answers): string {
  const merged = { ...caseAnswers, ...answers };
  const missing = missingFields(merged);
  const { done, total } = progress(merged);
  return [
    STATE_TAG,
    `progress: ${done}/${total}`,
    `saved: ${JSON.stringify(answers)}`,
    `missing (in order): ${missing.map((f) => f.key).join(', ') || 'none'}`,
    `warnings: ${crossCheck(merged).join(' ') || 'none'}`,
    '</form_state>',
  ].join('\n');
}

export interface TurnInput {
  create: CreateMessage;
  model?: string;
  profile: Profile;
  answers: Answers;
  caseAnswers: Answers;
  messages: MessageParam[];
  status: ApplicantStatus;
  /** What the family member typed; empty to have the assistant open the conversation. */
  text: string;
}

export interface TurnResult {
  answers: Answers;
  messages: MessageParam[];
  status: ApplicantStatus;
  /** The assistant's reply for this turn, as shown in the chat. */
  reply: string;
}

const REFUSED = '抱歉，这个问题我没法回答。我们继续填表吧，有不清楚的地方可以问发链接给你的家人。';

/** Runs one exchange: the family member's message, any tool calls, and the assistant's reply. */
export async function runTurn(input: TurnInput): Promise<TurnResult> {
  let answers = { ...input.answers };
  let status = input.status;
  const messages = [...input.messages];
  const opener =
    messages.length === 0
      ? `（${input.profile.relation}「${input.profile.name}」刚打开页面，请先打招呼，简单说明要做什么、大概要准备护照和身份证，然后开始问第一个问题。）`
      : '';
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: formState(answers, input.caseAnswers) },
      { type: 'text', text: input.text.trim() || opener || '（继续）' },
    ],
  });

  const replies: string[] = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await input.create({
      model: input.model ?? DEFAULT_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    for (const block of response.content)
      if (block.type === 'text' && block.text.trim()) replies.push(block.text.trim());

    if (response.stop_reason === 'refusal') {
      replies.push(REFUSED);
      break;
    }
    if (response.stop_reason === 'pause_turn') continue;
    if (response.stop_reason !== 'tool_use') break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const out = runTool(block.name, block.input, answers, input.caseAnswers);
      answers = out.answers;
      if (out.finished) status = 'review';
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: out.content,
        is_error: out.isError,
      });
    }
    messages.push({ role: 'user', content: results });
  }

  return { answers, messages, status, reply: replies.join('\n\n') };
}

interface ToolOutcome {
  answers: Answers;
  content: string;
  isError: boolean;
  finished?: boolean;
}

export function runTool(
  name: string,
  input: unknown,
  answers: Answers,
  caseAnswers: Answers,
): ToolOutcome {
  if (name === 'save_answers') {
    const list = (input as { answers?: { key?: unknown; value?: unknown }[] }).answers;
    if (!Array.isArray(list))
      return { answers, content: 'answers must be an array', isError: true };
    const raw: Record<string, string> = {};
    const errors: string[] = [];
    for (const item of list) {
      const key = String(item?.key ?? '');
      if (!APPLICANT_KEYS.includes(key)) errors.push(`${key}: not a question for this applicant`);
      else raw[key] = String(item?.value ?? '');
    }
    const checked = checkAnswers(raw);
    const next = { ...answers, ...checked.values };
    const merged = { ...caseAnswers, ...next };
    const allErrors = [...errors, ...checked.errors];
    return {
      answers: next,
      isError: allErrors.length > 0 && Object.keys(checked.values).length === 0,
      content: JSON.stringify({
        saved: Object.keys(checked.values),
        errors: allErrors,
        warnings: crossCheck(merged),
        next_missing: missingFields(merged)
          .slice(0, 5)
          .map((f) => `${f.key} (${f.zh})`),
      }),
    };
  }
  if (name === 'finish_collection') {
    const missing = missingFields({ ...caseAnswers, ...answers });
    if (missing.length) {
      return {
        answers,
        isError: true,
        content: `Still missing: ${missing.map((f) => f.key).join(', ')}. Ask for these first, or tell the family member their relative can fill in what they do not know.`,
      };
    }
    return {
      answers,
      finished: true,
      isError: false,
      content: 'Done. The answers are now with the relative for review.',
    };
  }
  return { answers, content: `unknown tool ${name}`, isError: true };
}
