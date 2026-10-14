// The family landing page's reference half: steps, documents, fees, tips and
// links from the package's knowledge base, plus a few small date tools.
import {
  CHECKED_ON,
  DOCUMENTS,
  FEES,
  LINKS,
  STEPS,
  TIPS,
  VISA_TYPES,
  type VisaType,
} from '@shiqi/visa/forms';
import { Card, Field, Section, TextInput } from '@shiqi/ui';
import { useState } from 'react';
import { addMonths, ds160Date, parseDate } from './dates';
import { PORTAL, type Lang } from './text';

/** What to bring for one visa type, required items first. */
export function DocumentList({ visa, lang }: { visa: VisaType; lang: Lang }) {
  const t = PORTAL[lang];
  return (
    <ul className="visa__docs">
      {DOCUMENTS[visa].map((d) => (
        <li key={d.en} className={d.required ? 'visa__doc--required' : undefined}>
          <span className="visa__doc-tag">{d.required ? t.required : t.helpful}</span> {d[lang]}
        </li>
      ))}
    </ul>
  );
}

export function Guide({ lang }: { lang: Lang }) {
  const t = PORTAL[lang];
  const [visa, setVisa] = useState<VisaType>('B1/B2');
  return (
    <Section title={t.guide} description={t.checked(CHECKED_ON)}>
      <div className="visa__tabs" role="tablist" aria-label={t.guide}>
        {VISA_TYPES.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === visa}
            className={v === visa ? 'visa__tab visa__tab--on' : 'visa__tab'}
            onClick={() => setVisa(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="visa__guide">
        <Card padded>
          <h3>{t.steps}</h3>
          <ol className="visa__steps">
            {STEPS[visa].map((s) => (
              <li key={s.title.en}>
                <strong>{s.title[lang]}</strong>
                <p>{s[lang]}</p>
              </li>
            ))}
          </ol>
        </Card>
        <Card padded>
          <h3>{t.documents}</h3>
          <DocumentList visa={visa} lang={lang} />
        </Card>
        <Card padded>
          <h3>{t.fees}</h3>
          <dl className="visa__fees">
            {FEES.map((f) => (
              <div key={f.label.en}>
                <dt>{f.label[lang]}</dt>
                <dd>{f[lang]}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card padded>
          <h3>{t.tips}</h3>
          <ul>
            {TIPS.map((tip) => (
              <li key={tip.en}>{tip[lang]}</li>
            ))}
          </ul>
        </Card>
      </div>
    </Section>
  );
}

export function Links({ lang }: { lang: Lang }) {
  const t = PORTAL[lang];
  return (
    <Section title={t.links}>
      <div className="visa__links">
        {LINKS.map((l) => (
          <Card
            key={l.url}
            as="a"
            href={l.url}
            target="_blank"
            rel="noreferrer noopener"
            interactive
            padded
          >
            <strong>{l.title[lang]} ↗</strong>
            <p>{l.note[lang]}</p>
            <small className="visa__url">{new URL(l.url).hostname}</small>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function PassportTool({ lang }: { lang: Lang }) {
  const t = PORTAL[lang];
  const [expiry, setExpiry] = useState('');
  const [leave, setLeave] = useState('');
  const needed = leave ? addMonths(leave, 6) : '';
  return (
    <Card padded className="visa__tool">
      <h3>{t.passportTool}</h3>
      <Field label={t.passportExpiry}>
        {(c) => (
          <TextInput
            {...c}
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        )}
      </Field>
      <Field label={t.leaveUs}>
        {(c) => (
          <TextInput {...c} type="date" value={leave} onChange={(e) => setLeave(e.target.value)} />
        )}
      </Field>
      {expiry && needed && (
        <p className={expiry >= needed ? 'visa__ok' : 'visa__error'} role="status">
          {expiry >= needed ? t.passportOk : t.passportShort(needed)}
        </p>
      )}
    </Card>
  );
}

function StayTool({ lang }: { lang: Lang }) {
  const t = PORTAL[lang];
  const [entry, setEntry] = useState('');
  return (
    <Card padded className="visa__tool">
      <h3>{t.stayTool}</h3>
      <Field label={t.entryDate}>
        {(c) => (
          <TextInput {...c} type="date" value={entry} onChange={(e) => setEntry(e.target.value)} />
        )}
      </Field>
      {entry && <p role="status">{t.stayResult(addMonths(entry, 6))}</p>}
    </Card>
  );
}

function DateTool({ lang }: { lang: Lang }) {
  const t = PORTAL[lang];
  const [raw, setRaw] = useState('');
  const date = raw.trim() ? parseDate(raw) : null;
  return (
    <Card padded className="visa__tool">
      <h3>{t.dateTool}</h3>
      <Field label={t.dateInput}>
        {(c) => <TextInput {...c} value={raw} onChange={(e) => setRaw(e.target.value)} />}
      </Field>
      {raw.trim() && (
        <p role="status" className={date ? undefined : 'visa__error'}>
          {date ? (
            <>
              {t.dateResult} <code>{ds160Date(date)}</code> · <code>{date}</code>
            </>
          ) : (
            t.dateBad
          )}
        </p>
      )}
    </Card>
  );
}

export function Tools({ lang }: { lang: Lang }) {
  return (
    <Section title={PORTAL[lang].tools}>
      <div className="visa__tools">
        <PassportTool lang={lang} />
        <StayTool lang={lang} />
        <DateTool lang={lang} />
      </div>
    </Section>
  );
}
