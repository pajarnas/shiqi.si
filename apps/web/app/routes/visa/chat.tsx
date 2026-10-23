import {
  ATTACHMENT_TYPES,
  buildSheet,
  checkAnswers,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  progress,
  sectionsFor,
  transcript,
  type Attachment,
} from '@shiqi/visa/forms';
import { Button, Card, Section, TextArea } from '@shiqi/ui';
import { useEffect, useRef, useState } from 'react';
import { Form, Link, useFetcher } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import {
  AnswerForm,
  formAnswers,
  LangToggle,
  SheetView,
  useLang,
} from '~/features/visa/components';
import {
  chatLimit,
  describeError,
  loadPerson,
  PRIVATE_HEADERS,
  runTurn,
} from '~/features/visa/visa.server';
import { ACCEPT, shrink } from '~/features/visa/upload';
import type { Route } from './+types/chat';

export const meta = () => [{ title: '美签助手' }, { name: 'robots', content: 'noindex, nofollow' }];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? PRIVATE_HEADERS;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { visa, a, caseAnswers } = await loadPerson(request, params.id);
  return {
    id: a.id,
    name: a.profile.name,
    visa: a.profile.visa,
    status: a.status,
    chatOn: visa.create !== null,
    chat: transcript(a.messages),
    progress: progress(a.answers, a.profile.visa),
    answers: a.answers,
    answersZh: a.answersZh,
    sheet: a.status === 'collecting' ? null : buildSheet(a.profile.visa, caseAnswers, a.answers),
  };
}

type Problem = 'chatOff' | 'busy' | 'failed' | 'badFile';

/** The uploaded files, held in memory only for this one request. */
async function readFiles(form: FormData): Promise<Attachment[] | null> {
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_ATTACHMENTS) return null;
  const out: Attachment[] = [];
  for (const f of files) {
    if (!(ATTACHMENT_TYPES as readonly string[]).includes(f.type)) return null;
    if (f.size > MAX_ATTACHMENT_BYTES) return null;
    const data = Buffer.from(await f.arrayBuffer()).toString('base64');
    out.push({ name: f.name.slice(0, 80) || 'file', mediaType: f.type, data });
  }
  return out;
}

export async function action({ request, params }: Route.ActionArgs) {
  const { visa, a, caseAnswers } = await loadPerson(request, params.id);
  const form = await request.formData();
  const intent = form.get('intent');

  if (intent === 'say' || intent === 'start') {
    const text = String(form.get('text') ?? '').slice(0, 4000);
    if (!visa.create) return { problem: 'chatOff' as Problem };
    const attachments = intent === 'say' ? await readFiles(form) : [];
    if (!attachments) return { problem: 'badFile' as Problem };
    if (intent === 'say' && !text.trim() && attachments.length === 0) return null;
    if (intent === 'start' && a.messages.length > 0) return null;
    if (!chatLimit.take(String(a.id))) return { problem: 'busy' as Problem };
    try {
      const out = await runTurn({
        create: visa.create,
        model: visa.model,
        ...a,
        caseAnswers,
        text,
        attachments,
      });
      await visa.store.saveApplicant({ id: a.id, ...out });
      return null;
    } catch (err) {
      const detail = describeError(err);
      console.warn('[visa] chat turn failed:', detail);
      return { problem: 'failed' as Problem, detail };
    }
  }
  if (intent === 'edit') {
    const own = sectionsFor(a.profile.visa).filter((s) => s.scope === 'applicant');
    const { values, errors } = checkAnswers(formAnswers(form, own));
    // A Chinese note no longer matches an answer that was changed by hand.
    const answersZh = Object.fromEntries(
      Object.entries(a.answersZh).filter(
        ([k]) => values[k] === undefined || values[k] === a.answers[k],
      ),
    );
    await visa.store.saveApplicant({ ...a, answers: { ...a.answers, ...values }, answersZh });
    return { errors };
  }
  if (intent === 'confirm') await visa.store.saveApplicant({ ...a, status: 'confirmed' });
  if (intent === 'reopen') await visa.store.saveApplicant({ ...a, status: 'collecting' });
  return null;
}

export default function VisaChat({ loaderData: d, actionData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const end = useRef<HTMLDivElement>(null);
  const sending = fetcher.state !== 'idle';
  const pendingNames = sending
    ? (fetcher.formData?.getAll('files') ?? [])
        .filter((f): f is File => f instanceof File)
        .map((f) => f.name)
    : [];
  const pendingText = sending
    ? [
        pendingNames.length ? `📎 ${pendingNames.join('、')}` : '',
        fetcher.formData?.get('text') ?? '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const [files, setFiles] = useState<File[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const [lang, t, setLang] = useLang();
  const problem = fetcher.data && 'problem' in fetcher.data ? fetcher.data.problem : null;
  const detail = fetcher.data && 'detail' in fetcher.data ? fetcher.data.detail : null;
  const own = sectionsFor(d.visa).filter((s) => s.scope === 'applicant');
  const errors = actionData && 'errors' in actionData ? actionData.errors : [];

  // A fresh link: let the assistant say hello first.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && d.chatOn && d.chat.length === 0 && d.status === 'collecting') {
      started.current = true;
      void fetcher.submit({ intent: 'start' }, { method: 'post' });
    }
  }, [d.chatOn, d.chat.length, d.status, fetcher]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [d.chat.length, sending]);

  return (
    <PageWindow
      file={`chat/visa/${d.id}`}
      eyebrow={`${t.eyebrow} · ${d.visa}`}
      title={t.chatTitle(d.name)}
      lede={t.chatLede}
    >
      <div className="visa__bar">
        <Link to={`/visa/${d.id}`}>← {t.openCard}</Link>
        <LangToggle lang={lang} onChange={setLang} />
      </div>
      <p className="visa__note">
        {t.privacy} {t.progress} {d.progress.done}/{d.progress.total}
      </p>
      <progress className="visa__progress" value={d.progress.done} max={d.progress.total} />

      {d.status === 'collecting' ? (
        <>
          {!d.chatOn && <Card padded>{t.chatOff}</Card>}
          <Card padded className="visa__chat" aria-live="polite">
            {d.chat.map((m, i) => (
              <p key={i} className={`visa__bubble visa__bubble--${m.role}`}>
                {m.text}
              </p>
            ))}
            {pendingText && <p className="visa__bubble visa__bubble--user">{pendingText}</p>}
            {sending && (
              <p className="visa__bubble visa__bubble--assistant visa__typing">{t.thinking}</p>
            )}
            {problem && (
              <p className="visa__error">
                {t[problem]}
                {detail && <small className="visa__detail">{detail}</small>}
              </p>
            )}
            <div ref={end} />
          </Card>
          {d.chatOn && (
            <fetcher.Form
              method="post"
              encType="multipart/form-data"
              className="visa__composer"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                fd.delete('files');
                if (!String(fd.get('text') ?? '').trim() && files.length === 0) return;
                const chosen = files;
                form.reset();
                setFiles([]);
                void Promise.all(chosen.map(shrink)).then((small) => {
                  for (const f of small) fd.append('files', f);
                  void fetcher.submit(fd, { method: 'post', encType: 'multipart/form-data' });
                });
              }}
            >
              <input type="hidden" name="intent" value="say" />
              <input
                ref={picker}
                type="file"
                name="files"
                accept={ACCEPT}
                multiple
                hidden
                onChange={(e) => {
                  const picked = [...files, ...Array.from(e.currentTarget.files ?? [])];
                  setTooMany(picked.length > MAX_ATTACHMENTS);
                  setFiles(picked.slice(0, MAX_ATTACHMENTS));
                  e.currentTarget.value = '';
                }}
              />
              <div className="visa__compose">
                <TextArea
                  name="text"
                  rows={3}
                  placeholder={t.placeholder}
                  aria-label={t.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                      e.currentTarget.form?.requestSubmit();
                  }}
                />
                <div className="visa__files">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => picker.current?.click()}
                    disabled={sending || files.length >= MAX_ATTACHMENTS}
                  >
                    📎 {t.attach}
                  </Button>
                  {files.map((f, i) => (
                    <span key={`${f.name}-${i}`} className="visa__file">
                      {f.name}
                      <button
                        type="button"
                        aria-label={`${t.removeFile} ${f.name}`}
                        onClick={() => {
                          setFiles(files.filter((_, j) => j !== i));
                          setTooMany(false);
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <small>{tooMany ? t.tooManyFiles : t.attachNote}</small>
                </div>
              </div>
              <Button type="submit" disabled={sending}>
                {t.send}
              </Button>
            </fetcher.Form>
          )}
          {!d.chatOn && (
            <Section title={t.reviewTitle}>
              <Card padded>
                <AnswerForm
                  key={JSON.stringify(d.answers)}
                  sections={own}
                  answers={d.answers}
                  intent="edit"
                  submitLabel={t.save}
                  errors={errors}
                  lang={lang}
                />
              </Card>
            </Section>
          )}
        </>
      ) : (
        <>
          {d.status === 'confirmed' && <Card padded>{t.confirmedNote}</Card>}
          {d.sheet && <SheetView sheet={d.sheet} answersZh={d.answersZh} lang={lang} />}
          <Section title={t.reviewTitle} description={t.reviewDesc}>
            <Card padded>
              <AnswerForm
                key={JSON.stringify(d.answers)}
                sections={own}
                answers={d.answers}
                intent="edit"
                submitLabel={t.save}
                errors={errors}
                lang={lang}
              />
            </Card>
          </Section>
          <div className="visa__actions">
            {d.status === 'review' && (
              <Form method="post">
                <input type="hidden" name="intent" value="confirm" />
                <Button type="submit">{t.confirm}</Button>
              </Form>
            )}
            {d.chatOn && (
              <Form method="post">
                <input type="hidden" name="intent" value="reopen" />
                <Button type="submit" variant="secondary">
                  {t.keepChatting}
                </Button>
              </Form>
            )}
          </div>
        </>
      )}
    </PageWindow>
  );
}
