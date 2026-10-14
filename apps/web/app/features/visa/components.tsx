// Pieces the visa pages share: an editable form for a set of DS-160 sections,
// and the read-only answer sheet.
import {
  SECTIONS,
  type Answers,
  type Field as VisaField,
  type Section as VisaSection,
  type Sheet,
} from '@shiqi/visa/forms';
import { Button, Card, Field, Select, TextArea, TextInput } from '@shiqi/ui';
import { Form } from 'react-router';
import { VISA_TEXT as T } from './text';

function Control({ field, value, id }: { field: VisaField; value: string; id: string }) {
  const common = { id, name: field.key, defaultValue: value };
  switch (field.type) {
    case 'date':
      return <TextInput {...common} type="date" />;
    case 'list':
      return <TextArea {...common} rows={3} />;
    case 'yesno':
      return (
        <Select {...common}>
          <option value="">{T.choose}</option>
          <option value="yes">{T.yes}</option>
          <option value="no">{T.no}</option>
        </Select>
      );
    case 'choice':
      return (
        <Select {...common}>
          <option value="">{T.choose}</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    default:
      return <TextInput {...common} />;
  }
}

/**
 * An edit form for every field of `scope` that applies to these answers. Posts
 * `intent` plus one form value per field key.
 */
export function AnswerForm({
  scope,
  answers,
  intent,
  submitLabel,
  errors = [],
}: {
  scope: VisaSection['scope'];
  answers: Answers;
  intent: string;
  submitLabel: string;
  errors?: readonly string[];
}) {
  return (
    <Form method="post" className="visa__form">
      <input type="hidden" name="intent" value={intent} />
      {SECTIONS.filter((s) => s.scope === scope).map((s) => (
        <fieldset key={s.id} className="visa__fieldset">
          <legend>
            {s.zh} <small>{s.en}</small>
          </legend>
          {s.fields
            .filter((f) => !f.when || f.when(answers))
            .map((f) => (
              <Field key={f.key} label={f.zh} hint={f.en}>
                {({ id }) => <Control field={f} value={answers[f.key] ?? ''} id={id} />}
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

/** The answer sheet: every applicable question with its DS-160 wording and answer. */
export function SheetView({ sheet }: { sheet: Sheet }) {
  return (
    <div className="visa__sheet">
      {sheet.warnings.length > 0 && (
        <Card padded className="visa__warnings">
          <strong>{T.warnings}</strong>
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
            {s.rows.map((r) => (
              <div key={r.key} className={r.missing ? 'visa__row visa__row--missing' : 'visa__row'}>
                <dt>
                  {r.en}
                  <small>{r.zh}</small>
                </dt>
                <dd>{r.value || (r.missing ? '—' : '')}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}

/** Reads a submitted AnswerForm back into raw answers, for keys of `scope` only. */
export function formAnswers(form: FormData, scope: VisaSection['scope']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of SECTIONS) {
    if (s.scope !== scope) continue;
    for (const f of s.fields) {
      const v = form.get(f.key);
      if (typeof v === 'string') out[f.key] = v;
    }
  }
  return out;
}
