import { buildSheet, checkAnswers, progress, transcript } from '@shiqi/visa/forms';
import { Button, Card, Section, TextArea } from '@shiqi/ui';
import { useEffect, useRef } from 'react';
import { Form, data, useFetcher } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { AnswerForm, SheetView, formAnswers } from '~/features/visa/components';
import { VISA_TEXT as T } from '~/features/visa/text';
import { chatLimit, getVisa, PRIVATE_HEADERS, runTurn } from '~/features/visa/visa.server';
import type { Route } from './+types/chat';

export const meta = () => [{ title: T.eyebrow }, { name: 'robots', content: 'noindex, nofollow' }];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? PRIVATE_HEADERS;
}

async function load(token: string) {
  const visa = await getVisa();
  if (!visa) throw data(null, { status: 503 });
  const a = await visa.store.applicantByToken(token);
  if (!a) throw data(null, { status: 404 });
  const c = await visa.store.getCase(a.caseId);
  return { visa, a, caseAnswers: c?.answers ?? {} };
}

export async function loader({ params }: Route.LoaderArgs) {
  const { visa, a, caseAnswers } = await load(params.token);
  return {
    name: a.profile.name,
    status: a.status,
    chatOn: visa.create !== null,
    chat: transcript(a.messages),
    progress: progress({ ...caseAnswers, ...a.answers }),
    answers: a.answers,
    sheet: a.status === 'collecting' ? null : buildSheet(caseAnswers, a.answers),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { visa, a, caseAnswers } = await load(params.token);
  const form = await request.formData();
  const intent = form.get('intent');

  if (intent === 'say' || intent === 'start') {
    const text = String(form.get('text') ?? '').slice(0, 4000);
    if (!visa.create) return { error: T.chatOff };
    if (intent === 'say' && !text.trim()) return null;
    if (intent === 'start' && a.messages.length > 0) return null;
    if (!chatLimit.take(String(a.id))) return { error: T.busy };
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
      console.warn('[visa] chat turn failed:', err instanceof Error ? err.message : err);
      return { error: T.failed };
    }
  }
  if (intent === 'edit') {
    const { values, errors } = checkAnswers(formAnswers(form, 'applicant'));
    await visa.store.saveApplicant({ ...a, answers: { ...a.answers, ...values } });
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
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : null;

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
    <PageWindow file={T.file} eyebrow={T.eyebrow} title={T.chatTitle(d.name)} lede={T.chatLede}>
      <p className="visa__note">
        {T.privacy} {T.progressLabel} {d.progress.done}/{d.progress.total}
      </p>
      <progress className="visa__progress" value={d.progress.done} max={d.progress.total} />

      {d.status === 'collecting' ? (
        <>
          {!d.chatOn && <Card padded>{T.chatOff}</Card>}
          <Card padded className="visa__chat" aria-live="polite">
            {d.chat.map((m, i) => (
              <p key={i} className={`visa__bubble visa__bubble--${m.role}`}>
                {m.text}
              </p>
            ))}
            {pendingText && <p className="visa__bubble visa__bubble--user">{pendingText}</p>}
            {sending && (
              <p className="visa__bubble visa__bubble--assistant visa__typing">{T.thinking}</p>
            )}
            {error && <p className="visa__error">{error}</p>}
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
                placeholder={T.placeholder}
                aria-label={T.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                    e.currentTarget.form?.requestSubmit();
                }}
              />
              <Button type="submit" disabled={sending}>
                {T.send}
              </Button>
            </fetcher.Form>
          )}
          {!d.chatOn && (
            <Section title={T.reviewTitle}>
              <Card padded>
                <AnswerForm
                  key={JSON.stringify(d.answers)}
                  scope="applicant"
                  answers={d.answers}
                  intent="edit"
                  submitLabel={T.save}
                  errors={actionData && 'errors' in actionData ? actionData.errors : []}
                />
              </Card>
            </Section>
          )}
        </>
      ) : (
        <>
          {d.status === 'confirmed' && <Card padded>{T.confirmedNote}</Card>}
          {d.sheet && <SheetView sheet={d.sheet} />}
          <Section title={T.reviewTitle} description={T.reviewDesc}>
            <Card padded>
              <AnswerForm
                key={JSON.stringify(d.answers)}
                scope="applicant"
                answers={d.answers}
                intent="edit"
                submitLabel={T.save}
                errors={actionData && 'errors' in actionData ? actionData.errors : []}
              />
            </Card>
          </Section>
          <div className="visa__actions">
            {d.status === 'review' && (
              <Form method="post">
                <input type="hidden" name="intent" value="confirm" />
                <Button type="submit">{T.confirm}</Button>
              </Form>
            )}
            {d.chatOn && (
              <Form method="post">
                <input type="hidden" name="intent" value="reopen" />
                <Button type="submit" variant="secondary">
                  {T.keepChatting}
                </Button>
              </Form>
            )}
          </div>
        </>
      )}
    </PageWindow>
  );
}
