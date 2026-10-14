// Checks one answer against its field before it is saved, and the whole form
// for problems that only show up across fields (an expiring passport).
import { fieldByKey, type Answers, type Field } from './schema';

export type Checked = { ok: true; value: string } | { ok: false; error: string };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDate(s: string): boolean {
  const m = DATE.exec(s);
  if (!m) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Normalises `raw` for `field`, or says what is wrong with it. */
export function checkAnswer(field: Field, raw: string): Checked {
  const value = raw.trim();
  if (!value) return { ok: true, value: '' };
  switch (field.type) {
    case 'date':
      return isDate(value)
        ? { ok: true, value }
        : { ok: false, error: `${field.key}: use YYYY-MM-DD` };
    case 'yesno': {
      const v = value.toLowerCase();
      return v === 'yes' || v === 'no'
        ? { ok: true, value: v }
        : { ok: false, error: `${field.key}: answer yes or no` };
    }
    case 'choice': {
      const v = value.toUpperCase();
      return field.options?.includes(v)
        ? { ok: true, value: v }
        : { ok: false, error: `${field.key}: must be one of ${field.options?.join(' | ')}` };
    }
    case 'list':
      return {
        ok: true,
        value: value
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .join('\n'),
      };
    case 'text':
      if (field.key === 'nationalId' && !/^\d{17}[\dX]$/.test(value.toUpperCase())) {
        return { ok: false, error: 'nationalId: 18 characters, digits with an optional final X' };
      }
      return { ok: true, value: field.key === 'nationalId' ? value.toUpperCase() : value };
  }
}

/** Checks a batch of answers by key; unknown keys are errors. */
export function checkAnswers(input: Record<string, string>): { values: Answers; errors: string[] } {
  const values: Answers = {};
  const errors: string[] = [];
  for (const [key, raw] of Object.entries(input)) {
    const field = fieldByKey(key);
    if (!field) {
      errors.push(`${key}: no such field`);
      continue;
    }
    const r = checkAnswer(field, String(raw ?? ''));
    if (r.ok) values[key] = r.value;
    else errors.push(r.error);
  }
  return { values, errors };
}

function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Problems across fields, in Chinese for the family and the organiser. */
export function crossCheck(a: Answers): string[] {
  const out: string[] = [];
  const { arrivalDate, passportExpiryDate, passportIssueDate, birthDate } = a;
  if (arrivalDate && passportExpiryDate && isDate(arrivalDate) && isDate(passportExpiryDate)) {
    const months = Number.parseInt(a.stayLength ?? '', 10);
    const unit = /DAY/i.test(a.stayLength ?? '') ? 0 : /WEEK/i.test(a.stayLength ?? '') ? 0.25 : 1;
    const stayMonths = Number.isFinite(months) ? Math.ceil(months * unit) : 0;
    if (passportExpiryDate < addMonths(arrivalDate, stayMonths + 6)) {
      out.push('护照有效期不够：离开美国后还要有至少 6 个月有效期，建议先换护照。');
    }
  }
  if (passportIssueDate && passportExpiryDate && passportIssueDate >= passportExpiryDate) {
    out.push('护照签发日期晚于有效期，可能填反了。');
  }
  if (birthDate && passportIssueDate && birthDate >= passportIssueDate) {
    out.push('出生日期晚于护照签发日期，请再核对。');
  }
  return out;
}
