import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { describeError, runTurn, type CreateMessage } from './agent';
import { transcript } from './transcript';
import { createSealer, createSigner } from './crypto';
import { parseFamily } from './family';
import { activeFields, applicantKeys, missingFields, progress, withShared } from './schema';
import { buildSheet } from './sheet';
import { checkAnswers, crossCheck, isDate } from './validate';

describe('validate', () => {
  it('accepts real dates only', () => {
    expect(isDate('1961-02-29')).toBe(false);
    expect(isDate('1964-02-29')).toBe(true);
    expect(isDate('1964/02/29')).toBe(false);
  });

  it('normalises answers and reports bad ones', () => {
    const { values, errors } = checkAnswers({
      sex: 'female',
      beenToUs: 'NO',
      nationalId: '11010519491231002x',
      birthDate: '1960-13-01',
      languages: ' CHINESE MANDARIN \n\n ENGLISH ',
      nope: 'x',
    });
    expect(values).toEqual({
      sex: 'FEMALE',
      beenToUs: 'no',
      nationalId: '11010519491231002X',
      languages: 'CHINESE MANDARIN\nENGLISH',
    });
    expect(errors).toHaveLength(2);
  });

  it('warns when the passport runs out too soon', () => {
    const a = {
      arrivalDate: '2027-03-01',
      stayLength: '3 MONTHS',
      passportExpiryDate: '2027-10-01',
    };
    expect(crossCheck(a)).toHaveLength(1);
    expect(crossCheck({ ...a, passportExpiryDate: '2028-01-01' })).toHaveLength(0);
  });
});

describe('schema', () => {
  it('asks spouse questions only of married applicants', () => {
    const keys = (s: string) =>
      activeFields({ maritalStatus: s }, 'B1/B2', 'applicant').map((f) => f.key);
    expect(keys('MARRIED')).toContain('spouseName');
    expect(keys('WIDOWED')).not.toContain('spouseName');
  });

  it('counts progress over required applicant fields', () => {
    const p = progress({ surname: 'ZHANG' }, 'B1/B2');
    expect(p.done).toBe(1);
    expect(missingFields({ surname: 'ZHANG' }, 'B1/B2')[0]?.key).toBe('givenNames');
  });
});

describe('crypto', () => {
  const sealer = createSealer('a-test-key-that-is-long-enough');

  it('round-trips and never stores plain text', () => {
    const sealed = sealer.seal({ passportNumber: 'E12345678' });
    expect(sealed).not.toContain('E12345678');
    expect(sealer.open(sealed)).toEqual({ passportNumber: 'E12345678' });
  });

  it('rejects tampered data and the wrong key', () => {
    const sealed = sealer.seal('hi');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('ho').toString('base64');
    expect(() => sealer.open(parts.join('.'))).toThrow();
    expect(() => createSealer('another-key-that-is-long-enough').open(sealed)).toThrow();
  });

  it('signs cookies that cannot be forged', () => {
    const signer = createSigner('a-test-key-that-is-long-enough');
    const signed = signer.sign('family.1900000000');
    expect(signer.verify(signed)).toBe('family.1900000000');
    expect(signer.verify(signed.replace('1900', '2900'))).toBeNull();
    expect(createSigner('another-key-that-is-long-enough').verify(signed)).toBeNull();
  });
});

describe('visa types', () => {
  it('asks H-1B applicants about their petition and their own trip', () => {
    const h = applicantKeys('H-1B');
    expect(h).toEqual(expect.arrayContaining(['petitionNumber', 'arrivalDate', 'contactName']));
    expect(h).not.toContain('stayLength');
    const b = applicantKeys('B1/B2');
    expect(b).not.toContain('petitionNumber');
    expect(b).not.toContain('arrivalDate');
  });

  it('shares the family trip only with visitors', () => {
    const family = { arrivalDate: '2027-05-01', contactName: 'ZHANG SHIQI' };
    expect(withShared('B1/B2', family, {}).arrivalDate).toBe('2027-05-01');
    expect(withShared('H-1B', family, {}).arrivalDate).toBeUndefined();
  });

  it('reads the family list', () => {
    expect(parseFamily('张三:B1/B2，李四：h-1b\n王五\n赵六:母亲:H-1B')).toEqual([
      { name: '张三', visa: 'B1/B2' },
      { name: '李四', visa: 'H-1B' },
      { name: '王五', visa: 'B1/B2' },
      { name: '赵六', visa: 'H-1B' },
    ]);
    expect(parseFamily(undefined)).toEqual([]);
  });
});

function reply(content: unknown[], stop_reason: string): Anthropic.Beta.BetaMessage {
  return {
    id: 'm',
    type: 'message',
    role: 'assistant',
    model: 'x',
    content,
    stop_reason,
  } as unknown as Anthropic.Beta.BetaMessage;
}

describe('runTurn', () => {
  it('saves answers through tools and replies in chat', async () => {
    const seen: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
    const queue = [
      reply(
        [
          { type: 'text', text: '好的，记下了。' },
          {
            type: 'tool_use',
            id: 't1',
            name: 'save_answers',
            input: {
              answers: [
                { key: 'surname', value: 'ZHANG', zh: '张' },
                { key: 'birthDate', value: '1960-1-1', zh: '' },
              ],
            },
          },
        ],
        'tool_use',
      ),
      reply([{ type: 'text', text: '出生日期是哪年哪月哪日？' }], 'end_turn'),
    ];
    const create: CreateMessage = async (p) => {
      seen.push(structuredClone(p));
      return queue.shift()!;
    };

    const out = await runTurn({
      create,
      profile: { name: '妈妈', visa: 'B1/B2' as const },
      answers: {},
      answersZh: {},
      caseAnswers: {},
      messages: [],
      status: 'collecting',
      text: '我姓张',
    });

    expect(out.answers).toEqual({ surname: 'ZHANG' });
    expect(out.answersZh).toEqual({ surname: '张' });
    expect(out.reply).toBe('好的，记下了。\n\n出生日期是哪年哪月哪日？');
    expect(seen).toHaveLength(2);
    const toolResult = JSON.stringify(seen[1]!.messages.at(-1));
    expect(toolResult).toContain('birthDate: use YYYY-MM-DD');
    expect(transcript(out.messages)).toEqual([
      { role: 'user', text: '我姓张' },
      { role: 'assistant', text: '好的，记下了。\n\n出生日期是哪年哪月哪日？' },
    ]);
  });

  it('only finishes once nothing is missing', async () => {
    const create: CreateMessage = async () =>
      reply([{ type: 'tool_use', id: 't', name: 'finish_collection', input: {} }], 'end_turn');
    const base = {
      create,
      profile: { name: '爸爸', visa: 'B1/B2' as const },
      answersZh: {},
      caseAnswers: {},
      messages: [],
      status: 'collecting' as const,
      text: '好了',
    };
    // end_turn with a tool_use block is not acted on; only tool_use stops run tools.
    expect((await runTurn({ ...base, answers: {} })).status).toBe('collecting');

    const finish: CreateMessage = async (p) =>
      p.messages.at(-1)?.role === 'user' &&
      Array.isArray(p.messages.at(-1)?.content) &&
      JSON.stringify(p.messages.at(-1)).includes('tool_result')
        ? reply([{ type: 'text', text: '好' }], 'end_turn')
        : reply([{ type: 'tool_use', id: 't', name: 'finish_collection', input: {} }], 'tool_use');
    expect((await runTurn({ ...base, create: finish, answers: {} })).status).toBe('collecting');
    const all = Object.fromEntries(
      activeFields({ maritalStatus: 'WIDOWED', occupation: 'RETIRED' }, 'B1/B2', 'applicant').map(
        (f) => [
          f.key,
          f.type === 'yesno'
            ? 'no'
            : f.type === 'date'
              ? '1960-01-01'
              : f.options
                ? f.options[0]!
                : 'X',
        ],
      ),
    );
    Object.assign(all, { maritalStatus: 'WIDOWED', occupation: 'RETIRED', securityAllNo: 'yes' });
    expect((await runTurn({ ...base, create: finish, answers: all })).status).toBe('review');
  });
});

describe('buildSheet', () => {
  it('fills shared trip answers and flags what is missing', () => {
    const sheet = buildSheet('B1/B2', { arrivalDate: '2027-05-01' }, { surname: 'ZHANG' });
    const trip = sheet.sections.find((s) => s.id === 'trip')!;
    expect(trip.rows.find((r) => r.key === 'arrivalDate')?.value).toBe('2027-05-01');
    expect(sheet.missing).toBeGreaterThan(10);
  });
});

describe('describeError', () => {
  it('names the status and the API message without the key', () => {
    const err = Anthropic.APIError.generate(
      401,
      { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
      undefined,
      new Headers(),
    );
    expect(describeError(err)).toBe('401 authentication_error invalid x-api-key');
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});

describe('attachments', () => {
  it('reads documents once and keeps the files out of the conversation', async () => {
    const seen: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
    const create: CreateMessage = async (p) => {
      seen.push(p);
      if (p.output_config?.format)
        return reply(
          [
            {
              type: 'text',
              text: JSON.stringify({
                documents: '护照个人信息页',
                fields: [
                  { key: 'surname', value: 'ZHANG', zh: '张' },
                  { key: 'passportNumber', value: 'E12345678', zh: '' },
                  { key: 'notAField', value: 'x', zh: '' },
                ],
              }),
            },
          ],
          'end_turn',
        );
      return reply([{ type: 'text', text: '看到了护照，请核对。' }], 'end_turn');
    };
    const out = await runTurn({
      create,
      profile: { name: '妈妈', visa: 'B1/B2' },
      answers: {},
      answersZh: {},
      caseAnswers: {},
      messages: [],
      status: 'collecting',
      text: '',
      attachments: [{ name: 'passport.jpg', mediaType: 'image/jpeg', data: 'QUJD' }],
    });
    expect(seen).toHaveLength(2);
    expect(JSON.stringify(seen[0]!.messages)).toContain('QUJD');
    expect(out.answers).toMatchObject({ surname: 'ZHANG', passportNumber: 'E12345678' });
    expect(out.answersZh).toEqual({ surname: '张' });
    expect(JSON.stringify(out.messages)).not.toContain('QUJD');
    expect(transcript(out.messages)).toEqual([
      { role: 'user', text: '📎 passport.jpg' },
      { role: 'assistant', text: '看到了护照，请核对。' },
    ]);
  });
});
