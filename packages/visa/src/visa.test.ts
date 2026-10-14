import type { Anthropic } from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { runTurn, type CreateMessage } from './agent';
import { transcript } from './transcript';
import { createSealer, hashToken, newToken } from './crypto';
import { activeFields, missingFields, progress } from './schema';
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
    const keys = (s: string) => activeFields({ maritalStatus: s }, 'applicant').map((f) => f.key);
    expect(keys('MARRIED')).toContain('spouseName');
    expect(keys('WIDOWED')).not.toContain('spouseName');
  });

  it('counts progress over required applicant fields', () => {
    const p = progress({ surname: 'ZHANG' });
    expect(p.done).toBe(1);
    expect(missingFields({ surname: 'ZHANG' })[0]?.key).toBe('givenNames');
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

  it('makes unguessable tokens', () => {
    const t = newToken();
    expect(t).toHaveLength(43);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
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
                { key: 'surname', value: 'ZHANG' },
                { key: 'birthDate', value: '1960-1-1' },
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
      profile: { name: '妈妈', relation: '母亲' },
      answers: {},
      caseAnswers: {},
      messages: [],
      status: 'collecting',
      text: '我姓张',
    });

    expect(out.answers).toEqual({ surname: 'ZHANG' });
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
      profile: { name: '爸爸', relation: '父亲' },
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
      activeFields({ maritalStatus: 'WIDOWED', occupation: 'RETIRED' }, 'applicant').map((f) => [
        f.key,
        f.type === 'yesno'
          ? 'no'
          : f.type === 'date'
            ? '1960-01-01'
            : f.options
              ? f.options[0]!
              : 'X',
      ]),
    );
    Object.assign(all, { maritalStatus: 'WIDOWED', occupation: 'RETIRED', securityAllNo: 'yes' });
    expect((await runTurn({ ...base, create: finish, answers: all })).status).toBe('review');
  });
});

describe('buildSheet', () => {
  it('fills shared trip answers and flags what is missing', () => {
    const sheet = buildSheet({ arrivalDate: '2027-05-01' }, { surname: 'ZHANG' });
    const trip = sheet.sections.find((s) => s.id === 'trip')!;
    expect(trip.rows.find((r) => r.key === 'arrivalDate')?.value).toBe('2027-05-01');
    expect(sheet.missing).toBeGreaterThan(10);
  });
});
