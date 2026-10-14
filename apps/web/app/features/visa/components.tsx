// Pieces the visa pages share: the language switch, an editable form for a set
// of DS-160 sections, and the read-only answer sheet.
import {
  fieldByKey,
  OPTION_ZH,
  TIPS_ZH,
  type Answers,
  type Field as VisaField,
  type Section as VisaSection,
  type Sheet,
} from '@shiqi/visa/forms';
import {
  Button,
  Card,
  Field,
  Segmented,
  Select,
  TextArea,
  TextInput,
  useLocalStorage,
} from '@shiqi/ui';
import { Form } from 'react-router';
import { PORTAL, type Lang, type PortalText } from './text';

/** The family pages' language, remembered in this browser. Chinese by default. */
export function useLang(): [Lang, PortalText, (lang: Lang) => void] {
  const [lang, setLang] = useLocalStorage<Lang>('visa-lang', 'zh');
  const safe = lang === 'en' ? 'en' : 'zh';
  return [safe, PORTAL[safe], setLang];
}

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <Segmented
      label={PORTAL[lang].lang}
      className="visa__lang"
      options={[
        { value: 'zh', label: '中文' },
        { value: 'en', label: 'English' },
      ]}
      value={lang}
      onChange={onChange}
    />
  );
}

/** A small ⓘ that shows what a question means on hover, focus or tap. */
export function Tip({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <span className="visa__tip" tabIndex={0} role="note" aria-label={text} data-tip={text}>
      ⓘ
    </span>
  );
}

/** The Chinese for an answer: what the family said, or the translation of a fixed option. */
export function answerZh(key: string, value: string, answersZh: Answers): string {
  const said = answersZh[key]?.trim();
  if (said && said !== value) return said;
  return OPTION_ZH[value] ?? '';
}

function Control({
  field,
  value,
  id,
  lang,
}: {
  field: VisaField;
  value: string;
  id: string;
  lang: Lang;
}) {
  const common = { id, name: field.key, defaultValue: value };
  const t = PORTAL[lang];
  const zh = lang === 'zh';
  switch (field.type) {
    case 'date':
      return <TextInput {...common} type="date" />;
    case 'list':
      return <TextArea {...common} rows={3} />;
    case 'yesno':
      return (
        <Select {...common}>
          <option value="">{t.choose}</option>
          <option value="yes">{t.yes}</option>
          <option value="no">{t.no}</option>
        </Select>
      );
    case 'choice':
      return (
        <Select {...common}>
          <option value="">{t.choose}</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {zh && OPTION_ZH[o] ? `${OPTION_ZH[o]} · ${o}` : o}
            </option>
          ))}
        </Select>
      );
    default:
      return <TextInput {...common} />;
  }
}

/**
 * An edit form for `sections`, showing the fields that apply to these answers.
 * Posts `intent` plus one form value per field key.
 */
export function AnswerForm({
  sections,
  answers,
  intent,
  submitLabel,
  errors = [],
  lang = 'zh',
  hidden = {},
}: {
  sections: readonly VisaSection[];
  /** Extra hidden form values, e.g. which case the answers belong to. */
  hidden?: Record<string, string>;
  answers: Answers;
  intent: string;
  submitLabel: string;
  errors?: readonly string[];
  lang?: Lang;
}) {
  return (
    <Form method="post" className="visa__form">
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {sections.map((s) => (
        <fieldset key={s.id} className="visa__fieldset">
          <legend>
            {lang === 'zh' ? s.zh : s.en} <small>{lang === 'zh' ? s.en : s.zh}</small>
          </legend>
          {s.fields
            .filter((f) => !f.when || f.when(answers))
            .map((f) => (
              <Field
                key={f.key}
                label={lang === 'zh' ? f.zh : f.en}
                hint={[lang === 'zh' ? f.en : f.zh, TIPS_ZH[f.key]].filter(Boolean).join(' · ')}
              >
                {({ id }) => <Control field={f} value={answers[f.key] ?? ''} id={id} lang={lang} />}
              </Field>
            ))}
        </fieldset>
      ))}
      {errors.length > 0 && (
        <ul className="visa__errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <Button type="submit">{submitLabel}</Button>
    </Form>
  );
}

/** Reads a submitted AnswerForm back into raw answers, for the fields of `sections` only. */
export function formAnswers(
  form: FormData,
  sections: readonly VisaSection[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of sections.flatMap((s) => s.fields)) {
    const v = form.get(f.key);
    if (typeof v === 'string') out[f.key] = v;
  }
  return out;
}

/**
 * The answer sheet: every applicable question with its DS-160 wording, the
 * English answer to type in, and the Chinese beside it.
 */
export function SheetView({
  sheet,
  answersZh = {},
  lang = 'zh',
}: {
  sheet: Sheet;
  answersZh?: Answers;
  lang?: Lang;
}) {
  const t = PORTAL[lang];
  return (
    <div className="visa__sheet">
      {sheet.warnings.length > 0 && (
        <Card padded className="visa__warnings">
          <strong>{t.warnings}</strong>
          <ul>
            {sheet.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}
      {sheet.sections.map((s) => (
        <Card key={s.id} className="visa__sheet-section">
          <h3>
            {s.en} <small>{s.zh}</small>
          </h3>
          <dl>
            {s.rows.map((r) => {
              const zh = r.value ? answerZh(r.key, r.value, answersZh) : '';
              const tip = lang === 'zh' ? TIPS_ZH[r.key] : fieldByKey(r.key)?.hint;
              return (
                <div
                  key={r.key}
                  className={r.missing ? 'visa__row visa__row--missing' : 'visa__row'}
                >
                  <dt>
                    {r.en} <Tip text={tip} />
                    <small>{r.zh}</small>
                  </dt>
                  <dd>
                    {r.value || (r.missing ? t.missing : t.none)}
                    {zh && <small className="visa__zh">{zh}</small>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      ))}
    </div>
  );
}
