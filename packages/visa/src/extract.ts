// Reads answers off documents the family uploads in the chat (passport, old
// visas, I-797, ID cards) with one separate request, so the images never enter
// the stored conversation: only the extracted answers and a short note do.
import type Anthropic from '@anthropic-ai/sdk';
import type { CreateMessage } from './agent';
import { applicantKeys, sectionsFor, type VisaType } from './schema';

/** One uploaded file, already in memory. Nothing here is written to disk or the database. */
export interface Attachment {
  name: string;
  mediaType: string;
  /** The file's bytes, base64-encoded. */
  data: string;
}

export const ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;
export const MAX_ATTACHMENTS = 4;
/** Per file, before base64. The page shrinks photos well below this first. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export interface ExtractedField {
  key: string;
  value: string;
  zh: string;
}

export interface Extraction {
  /** One line, in Chinese, on what each file turned out to be. */
  documents: string;
  fields: ExtractedField[];
}

type ImageType = Anthropic.Beta.BetaBase64ImageSource['media_type'];

function block(a: Attachment): Anthropic.Beta.BetaContentBlockParam {
  return a.mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } }
    : {
        type: 'image',
        source: { type: 'base64', media_type: a.mediaType as ImageType, data: a.data },
      };
}

function fieldGuide(visa: VisaType): string {
  return sectionsFor(visa)
    .filter((s) => s.scope === 'applicant')
    .flatMap((s) => s.fields)
    .map((f) => {
      const bits = [`- ${f.key} (${f.type}): ${f.en} / ${f.zh}`];
      if (f.options) bits.push(` options: ${f.options.join(' | ')}`);
      if (f.hint) bits.push(` note: ${f.hint}`);
      return bits.join('');
    })
    .join('\n');
}

const PROMPT = `These files were uploaded by a family member preparing a U.S. DS-160 visa application: usually a passport, an old U.S. visa, a Chinese ID card, an I-797 notice or an employment letter.

Read every file and return the DS-160 answers they show, using only the field keys below.
- Copy only what is printed and clearly legible. Never guess, and leave out anything cut off, blurred or covered.
- Names in capital pinyin exactly as in the passport (the machine-readable lines decide). Dates as YYYY-MM-DD. Choice fields must use one of the listed options exactly. yesno fields are "yes" or "no".
- zh: the value as a Chinese reader would know it (the Chinese name, the place in Chinese, or a short translation); empty when it adds nothing.
- documents: one short line in Simplified Chinese saying what each file is (e.g. "护照个人信息页；旧的 B1/B2 签证"), or that a file could not be read.

Fields:
`;

/** Pulls the answers these files show. Returns no fields if the model declines or the reply is unusable. */
export async function readDocuments(input: {
  create: CreateMessage;
  model: string;
  visa: VisaType;
  files: readonly Attachment[];
}): Promise<Extraction> {
  const keys = applicantKeys(input.visa);
  const response = await input.create({
    model: input.model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            documents: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', enum: keys },
                  value: { type: 'string' },
                  zh: { type: 'string' },
                },
                required: ['key', 'value', 'zh'],
                additionalProperties: false,
              },
            },
          },
          required: ['documents', 'fields'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          ...input.files.map(block),
          { type: 'text', text: PROMPT + fieldGuide(input.visa) },
        ],
      },
    ],
  });
  if (response.stop_reason === 'refusal') return { documents: '', fields: [] };
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    const parsed = JSON.parse(text) as Partial<Extraction>;
    return {
      documents: String(parsed.documents ?? ''),
      fields: (parsed.fields ?? []).filter((f) => keys.includes(f.key) && f.value?.trim()),
    };
  } catch {
    return { documents: '', fields: [] };
  }
}
