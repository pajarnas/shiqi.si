import { buildSheet, checkAnswers, progress, sectionsFor, transcript } from '@shiqi/visa/forms';
import { Button, Card, Section, TextArea } from '@shiqi/ui';
import { useEffect, useRef } from 'react';
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

type Problem = 'chatOff' | 'busy' | 'failed';

export async function action({ request, params }: Route.ActionArgs) {
  const { visa, a, caseAnswers } = await loadPerson(request, params.id);
  const form = await request.formData();
  const intent = form.get('intent');

  if (intent === 'say' || intent === 'start') {
    const text = String(form.get('text') ?? '').slice(0, 4000);
    if (!visa.create) return { problem: 'chatOff' as Problem };
    if (intent === 'say' && !text.trim()) return null;
    if (intent === 'start' && a.messages.length > 0) return null;
    if (!chatLimit.take(String(a.id))) return { problem: 'busy' as Problem };
    try {
      const out = await runTurn({
        create: visa.create,
        model: visa.model,
        ...a,
        caseAnswers,
        text,
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
  const pendingText = sending ? String(fetcher.formData?.get('text') ?? '') : '';
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
              className="visa__composer"
              onSubmit={(e) => {
                const form = e.currentTarget;
                requestAnimationFrame(() => form.reset());
              }}
            >
              <input type="hidden" name="intent" value="say" />
              <TextArea
                name="text"
                rows={3}
                required
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                    e.currentTarget.form?.requestSubmit();
                }}
              />
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
