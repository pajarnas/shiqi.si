import { buildSheet, checkAnswers, progress, sectionsFor } from '@shiqi/visa/forms';
import { Badge, Button, Card, Field, Section, TextInput } from '@shiqi/ui';
import { Form, Link, data, redirect } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { AnswerForm, formAnswers, LangToggle, useLang } from '~/features/visa/components';
import { Guide, Links, Tools } from '~/features/visa/guide';
import {
  familyLoginEnabled,
  FAMILY_HOME,
  getVisa,
  isFamily,
  login,
  logoutCookie,
  PRIVATE_HEADERS,
  requireFamily,
} from '~/features/visa/visa.server';
import type { Route } from './+types/home';

export const meta = () => [{ title: '美签助手' }, { name: 'robots', content: 'noindex, nofollow' }];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? PRIVATE_HEADERS;
}

/** The family's shared sections: only visitors share a trip. */
const SHARED = sectionsFor('B1/B2').filter((s) => s.scope === 'case');

export async function loader({ request }: Route.LoaderArgs) {
  if (!familyLoginEnabled()) return { state: 'off' as const };
  if (!isFamily(request)) return { state: 'login' as const };
  const visa = await getVisa();
  if (!visa) return { state: 'unavailable' as const };
  const [cases, people] = await Promise.all([visa.store.listCases(), visa.store.listApplicants()]);
  const sharedKeys = SHARED.flatMap((s) => s.fields.filter((f) => !f.optional).map((f) => f.key));
  return {
    state: 'in' as const,
    cases: cases.map((c) => ({
      id: c.id,
      label: c.label,
      answers: c.answers,
      shared: {
        done: sharedKeys.filter((k) => c.answers[k]?.trim()).length,
        total: sharedKeys.length,
      },
      people: people
        .filter((p) => p.caseId === c.id)
        .map((p) => {
          const missing = buildSheet(p.profile.visa, c.answers, p.answers).missing;
          return {
            id: p.id,
            name: p.profile.name,
            visa: p.profile.visa,
            status: p.status,
            progress: progress(p.answers, p.profile.visa),
            complete: missing === 0,
          };
        }),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  switch (form.get('intent')) {
    case 'login': {
      const result = login(request, String(form.get('password') ?? ''));
      if (!result.ok) return { reason: result.reason };
      return redirect(FAMILY_HOME, { headers: { 'Set-Cookie': result.cookie } });
    }
    case 'logout':
      return redirect(FAMILY_HOME, { headers: { 'Set-Cookie': logoutCookie } });
    case 'shared': {
      requireFamily(request);
      const visa = await getVisa();
      const c = visa && (await visa.store.getCase(Number(form.get('caseId'))));
      if (!visa || !c) throw data(null, { status: 404 });
      const { values, errors } = checkAnswers(formAnswers(form, SHARED));
      await visa.store.saveCaseAnswers(c.id, { ...c.answers, ...values });
      return { errors };
    }
  }
  return null;
}

function LoginCard({ reason }: { reason?: 'wrong' | 'busy' }) {
  const [lang, t, setLang] = useLang();
  return (
    <PageWindow file="visa" eyebrow={t.eyebrow} title={t.loginTitle} lede={t.loginLede}>
      <LangToggle lang={lang} onChange={setLang} />
      <Card padded className="visa__login">
        <Form method="post" className="visa__inline">
          <input type="hidden" name="intent" value="login" />
          <Field
            label={t.password}
            error={reason === 'wrong' ? t.wrong : reason === 'busy' ? t.busyLogin : undefined}
          >
            {(c) => (
              <TextInput
                {...c}
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            )}
          </Field>
          <Button type="submit">{t.login}</Button>
        </Form>
      </Card>
    </PageWindow>
  );
}

export default function VisaHome({ loaderData: d, actionData }: Route.ComponentProps) {
  const [lang, t, setLang] = useLang();
  if (d.state === 'login')
    return (
      <LoginCard reason={actionData && 'reason' in actionData ? actionData.reason : undefined} />
    );
  if (d.state !== 'in')
    return (
      <PageWindow file="visa" eyebrow={t.eyebrow} title={t.title}>
        <Card padded>{d.state === 'off' ? t.loginOff : t.unavailable}</Card>
      </PageWindow>
    );

  const errors = actionData && 'errors' in actionData ? actionData.errors : undefined;
  return (
    <PageWindow file="visa" eyebrow={t.eyebrow} title={t.title} lede={t.lede}>
      <div className="visa__bar">
        <LangToggle lang={lang} onChange={setLang} />
        <Form method="post">
          <input type="hidden" name="intent" value="logout" />
          <Button type="submit" variant="ghost" size="sm">
            {t.logout}
          </Button>
        </Form>
      </div>

      {d.cases.length === 0 && <Card padded>{t.noPeople}</Card>}
      {d.cases.map((c) => (
        <Section key={c.id} title={d.cases.length > 1 ? c.label : t.people}>
          <div className="visa__cards">
            {c.people.map((p) => (
              <Card
                key={p.id}
                padded
                className={p.complete ? 'visa__card visa__card--done' : 'visa__card'}
              >
                <div className="visa__card-head">
                  <span className="visa__avatar" aria-hidden="true">
                    {p.name.slice(-1)}
                  </span>
                  <strong className="visa__card-name">{p.name}</strong>
                  <span className="visa__visa">{p.visa}</span>
                </div>
                <p className="visa__card-status">
                  <Badge tone={p.complete || p.status !== 'collecting' ? 'green' : 'gold'}>
                    {p.complete && p.status === 'collecting' ? t.complete : t.status[p.status]}
                  </Badge>{' '}
                  {t.progress} {p.progress.done}/{p.progress.total}
                </p>
                <progress
                  className="visa__progress"
                  value={p.progress.done}
                  max={p.progress.total}
                  aria-label={`${p.name} ${t.progress}`}
                />
                <div className="visa__actions">
                  <Button as={Link} to={`/visa/${p.id}`} size="sm" variant="secondary">
                    {t.openCard}
                  </Button>
                  <Button as={Link} to={`/chat/visa/${p.id}`} size="sm">
                    {t.openChat}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {c.people.some((p) => p.visa === 'B1/B2') && (
            <details className="visa__shared">
              <summary>
                {t.sharedTitle} · {t.sharedDone(c.shared.done, c.shared.total)}
              </summary>
              <p>{t.sharedDesc}</p>
              <AnswerForm
                key={JSON.stringify(c.answers)}
                sections={SHARED}
                answers={c.answers}
                intent="shared"
                hidden={{ caseId: String(c.id) }}
                submitLabel={t.save}
                errors={errors}
                lang={lang}
              />
            </details>
          )}
        </Section>
      ))}

      <Guide lang={lang} />
      <Tools lang={lang} />
      <Links lang={lang} />
    </PageWindow>
  );
}
