// The chat assistant that interviews one family member. Each turn sends the
// whole conversation (append-only, so prompt caching and thinking carry over)
// and lets Claude record answers through tools; nothing is saved from free text.
import Anthropic from '@anthropic-ai/sdk';
import type { ApplicantStatus, Profile } from './store';
import {
  applicantKeys,
  missingFields,
  progress,
  sectionsFor,
  VISA_TYPES,
  withShared,
  type Answers,
  type VisaType,
} from './schema';
import { knowledgeDigest } from './knowledge';
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

/** Every key any applicant may save; save_answers then checks it against the person's visa. */
const ANY_APPLICANT_KEY = [...new Set(VISA_TYPES.flatMap((v) => applicantKeys(v)))];

function questionList(visa: VisaType): string {
  return sectionsFor(visa)
    .filter((s) => s.scope === 'applicant')
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

const ABOUT: Record<VisaType, string> = {
  'B1/B2':
    'This person is applying for a B1/B2 visitor visa, usually B2 to visit family in the U.S. Trip and U.S. contact details are filled in once by the organiser and shared by the family travelling together; you do not need to ask them.',
  'H-1B':
    'This person works in the U.S. on an H-1B and needs a new visa stamp on a trip home (an H-1B renewal, with an approved I-797 petition). Ask the trip, petition and U.S. contact questions too. Their present employer is the U.S. employer, and their home address is where they live in the U.S. now.',
};

/** The system prompt for one visa type. Stable per type, so it stays cached. */
export function systemPrompt(visa: VisaType): string {
  return `You help a Chinese family prepare U.S. visa applications (form DS-160) on their private family page. ${ABOUT[visa]}

The person typing may be the applicant or another family member filling in for them (a parent for a child, a son or daughter for an older parent). Many are older and not used to forms, so be warm, patient and plain. If it is not clear who is typing, ask once.

How to talk:
- Default to simple Simplified Chinese. If they write to you in English, answer in English, and switch back if they switch back. Short messages. Ask one or two things at a time, in the order of the list below, and say where to find the answer when it helps (e.g. 护照首页, I-797 右上角).
- Each user turn starts with a ${STATE_TAG} block: the answers saved so far, what is still missing and any warnings. Use it to decide what to ask next; the family does not see it.
- When they answer, convert it to how it is typed into the DS-160: English, uppercase pinyin for names and places, dates as YYYY-MM-DD. Read conversions back in a few words (e.g. "张小明 → ZHANG XIAOMING") and fix anything they correct.
- Save every answer with the save_answers tool as soon as you have it. Save "NONE" for list questions they have nothing for. If the tool reports an error, ask again.
- Never guess or invent an answer. If they do not know, say it can be filled in later and move on.
- Security and background questions: explain what is being asked in plain words and let them answer. Never answer for them or hint at what to say. If anything is "yes", say the family organiser will go through it with them.
- This is not legal advice and you cannot submit anything; the family submits the form on ceac.state.gov themselves. If asked about chances, fees, interviews or interview waivers, give general information and suggest checking the official site.
- If they wander off topic, answer briefly and come back to the form.
- When the missing list is empty, check with them that everything is right, then call finish_collection and tell them the organiser will review it. They can still change answers on the review page.

Use the knowledge below to answer questions about steps, documents, fees and links. It was checked on the date shown; for anything else, or anything that may have changed, point them to the official sites.

${knowledgeDigest()}

# Questions for a ${visa} applicant (DS-160 field key, type, wording)

${questionList(visa)}`;
}

export const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: 'save_answers',
    description:
      'Saves one or more answers to the form. `value` must already be in DS-160 format: English, uppercase pinyin for names and places, dates as YYYY-MM-DD, yesno as "yes"/"no", choice as one of the listed options, list as one item per line. `zh` is the same answer in Chinese as the family would read it (their own words for names, addresses, employers; a short translation otherwise), or "" when it is a date, number or fixed option. Returns what was saved, any errors, cross-field warnings and the next questions still missing.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', enum: ANY_APPLICANT_KEY },
              value: { type: 'string' },
              zh: { type: 'string' },
            },
            required: ['key', 'value', 'zh'],
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

function formState(visa: VisaType, answers: Answers, caseAnswers: Answers): string {
  const merged = withShared(visa, caseAnswers, answers);
  const missing = missingFields(merged, visa);
  const { done, total } = progress(merged, visa);
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
  answersZh: Answers;
  caseAnswers: Answers;
  messages: MessageParam[];
  status: ApplicantStatus;
  /** What the family member typed; empty to have the assistant open the conversation. */
  text: string;
}

export interface TurnResult {
  answers: Answers;
  answersZh: Answers;
  messages: MessageParam[];
  status: ApplicantStatus;
  /** The assistant's reply for this turn, as shown in the chat. */
  reply: string;
}

const REFUSED =
  '抱歉，这个问题我没法回答。我们继续填表吧，有不清楚的地方可以问问家里负责办签证的人。';

/** Runs one exchange: the family member's message, any tool calls, and the assistant's reply. */
export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const visa = input.profile.visa;
  let answers = { ...input.answers };
  let answersZh = { ...input.answersZh };
  let status = input.status;
  const messages = [...input.messages];
  const opener =
    messages.length === 0
      ? `（现在开始为${input.profile.relation}「${input.profile.name}」准备 ${visa} 签证的资料，打字的可能是本人，也可能是家人代填。请先打招呼，简单说明要做什么、要准备哪些证件，然后开始问第一个问题。）`
      : '';
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: formState(visa, answers, input.caseAnswers) },
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
      system: systemPrompt(visa),
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
      const out = runTool(visa, block.name, block.input, { answers, answersZh }, input.caseAnswers);
      answers = out.answers;
      answersZh = out.answersZh;
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

  return { answers, answersZh, messages, status, reply: replies.join('\n\n') };
}

interface Saved {
  answers: Answers;
  answersZh: Answers;
}

interface ToolOutcome extends Saved {
  content: string;
  isError: boolean;
  finished?: boolean;
}

export function runTool(
  visa: VisaType,
  name: string,
  input: unknown,
  saved: Saved,
  caseAnswers: Answers,
): ToolOutcome {
  const { answers, answersZh } = saved;
  if (name === 'save_answers') {
    const list = (input as { answers?: { key?: unknown; value?: unknown; zh?: unknown }[] })
      .answers;
    if (!Array.isArray(list))
      return { ...saved, content: 'answers must be an array', isError: true };
    const allowed = applicantKeys(visa);
    const raw: Record<string, string> = {};
    const zh: Answers = {};
    const errors: string[] = [];
    for (const item of list) {
      const key = String(item?.key ?? '');
      if (!allowed.includes(key)) {
        errors.push(`${key}: not a question for a ${visa} applicant`);
        continue;
      }
      raw[key] = String(item?.value ?? '');
      zh[key] = String(item?.zh ?? '').trim();
    }
    const checked = checkAnswers(raw);
    const next = { ...answers, ...checked.values };
    const nextZh = { ...answersZh };
    for (const key of Object.keys(checked.values)) {
      if (zh[key]) nextZh[key] = zh[key];
      else delete nextZh[key];
    }
    const merged = withShared(visa, caseAnswers, next);
    const allErrors = [...errors, ...checked.errors];
    return {
      answers: next,
      answersZh: nextZh,
      isError: allErrors.length > 0 && Object.keys(checked.values).length === 0,
      content: JSON.stringify({
        saved: Object.keys(checked.values),
        errors: allErrors,
        warnings: crossCheck(merged),
        next_missing: missingFields(merged, visa)
          .slice(0, 5)
          .map((f) => `${f.key} (${f.zh})`),
      }),
    };
  }
  if (name === 'finish_collection') {
    const missing = missingFields(withShared(visa, caseAnswers, answers), visa);
    if (missing.length) {
      return {
        ...saved,
        isError: true,
        content: `Still missing: ${missing.map((f) => f.key).join(', ')}. Ask for these first, or tell them the organiser can fill in what they do not know.`,
      };
    }
    return {
      ...saved,
      finished: true,
      isError: false,
      content: 'Done. The answers are now with the organiser for review.',
    };
  }
  return { ...saved, content: `unknown tool ${name}`, isError: true };
}
