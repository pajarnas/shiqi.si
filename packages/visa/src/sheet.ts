// The DS-160 answer sheet: every question that applies, in form order, with the
// answer as it should be typed into ceac.state.gov.
import { SECTIONS, type Answers } from './schema';
import { crossCheck } from './validate';

export interface SheetRow {
  key: string;
  en: string;
  zh: string;
  value: string;
  missing: boolean;
}

export interface SheetSection {
  id: string;
  en: string;
  zh: string;
  rows: SheetRow[];
}

export interface Sheet {
  sections: SheetSection[];
  warnings: string[];
  missing: number;
}

/** Builds the sheet for one applicant; shared case answers fill in what they did not answer. */
export function buildSheet(caseAnswers: Answers, answers: Answers): Sheet {
  const merged = { ...caseAnswers, ...answers };
  let missing = 0;
  const sections = SECTIONS.map((s) => ({
    id: s.id,
    en: s.en,
    zh: s.zh,
    rows: s.fields
      .filter((f) => !f.when || f.when(merged))
      .map((f) => {
        const value = merged[f.key]?.trim() ?? '';
        const isMissing = !value && !f.optional;
        if (isMissing) missing++;
        return { key: f.key, en: f.en, zh: f.zh, value, missing: isMissing };
      }),
  }));
  return { sections, warnings: crossCheck(merged), missing };
}
