import { checkAnswers, progress } from '@shiqi/visa/forms';
import { Badge, Button, Card, Field, Section, TextInput } from '@shiqi/ui';
import { useState } from 'react';
import { Form, Link, data, redirect } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { AnswerForm, formAnswers } from '~/features/visa/components';
import { VISA_TEXT as T } from '~/features/visa/text';
import { adminOnly, chatUrl, getVisa, PRIVATE_HEADERS } from '~/features/visa/visa.server';
import type { Route } from './+types/case';

export const meta = ({ loaderData: d }: Route.MetaArgs) => [
  { title: `${d?.label ?? T.adminTitle} · shiqi.si` },
  { name: 'robots', content: 'noindex' },
];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? PRIVATE_HEADERS;
}

async function load(request: Request, caseId: string) {
  adminOnly(request);
  const visa = await getVisa();
  if (!visa) throw data(null, { status: 503 });
  const c = await visa.store.getCase(Number(caseId));
  if (!c) throw data(null, { status: 404 });
  return { visa, c };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { visa, c } = await load(request, params.caseId);
  const people = await visa.store.listApplicants(c.id);
  return {
    id: c.id,
    label: c.label,
    answers: c.answers,
    people: people.map((p) => ({
      id: p.id,
      name: p.profile.name,
      relation: p.profile.relation,
      status: p.status,
      progress: progress({ ...c.answers, ...p.answers }),
      link: chatUrl(request, p.token),
    })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { visa, c } = await load(request, params.caseId);
  const form = await request.formData();
  switch (form.get('intent')) {
    case 'shared': {
      const { values, errors } = checkAnswers(formAnswers(form, 'case'));
      await visa.store.saveCaseAnswers(c.id, { ...c.answers, ...values });
      return { errors, saved: errors.length === 0 };
    }
    case 'add': {
      const name = String(form.get('name') ?? '')
        .trim()
        .slice(0, 40);
      const relation = String(form.get('relation') ?? '')
        .trim()
        .slice(0, 40);
      if (name) await visa.store.addApplicant(c.id, { name, relation });
      return null;
    }
    case 'remove': {
      const id = Number(form.get('id'));
      const people = await visa.store.listApplicants(c.id);
      if (people.some((p) => p.id === id)) await visa.store.deleteApplicant(id);
      return null;
    }
    case 'deleteCase':
      await visa.store.deleteCase(c.id);
      return redirect('/visa/admin');
  }
  return null;
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(link).then(() => setCopied(true));
      }}
    >
      {copied ? T.copied : T.copyLink}
    </Button>
  );
}

function confirmSubmit(message: string) {
  return (e: React.FormEvent) => {
    if (!window.confirm(message)) e.preventDefault();
  };
}

export default function VisaCase({ loaderData: d, actionData }: Route.ComponentProps) {
  return (
    <PageWindow file={`${T.file}/${d.id}`} eyebrow={T.eyebrow} title={d.label}>
      <p>
        <Link to="/visa/admin">← {T.adminTitle}</Link>
      </p>

      <Section title={T.applicantsTitle}>
        <div className="visa__cases">
          {d.people.map((p) => (
            <Card key={p.id} padded className="visa__person">
              <strong>
                {p.name} <small>{p.relation}</small>
              </strong>
              <p>
                <Badge tone={p.status === 'collecting' ? 'gold' : 'green'}>
                  {T.status[p.status]}
                </Badge>{' '}
                {T.progress(p.progress.done, p.progress.total)}
              </p>
              <TextInput
                readOnly
                value={p.link}
                aria-label={T.copyLink}
                className="visa__link"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="visa__actions">
                <CopyLink link={p.link} />
                <Button
                  as={Link}
                  to={`/visa/admin/applicant/${p.id}`}
                  variant="secondary"
                  size="sm"
                >
                  {T.openSheet}
                </Button>
                <Form method="post" onSubmit={confirmSubmit(T.confirmRemove)}>
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="id" value={p.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    {T.remove}
                  </Button>
                </Form>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={T.addTitle} description={T.addDesc}>
        <Form key={d.people.length} method="post" className="visa__inline">
          <input type="hidden" name="intent" value="add" />
          <Field label={T.name}>
            {(c) => <TextInput {...c} name="name" required maxLength={40} />}
          </Field>
          <Field label={T.relation}>
            {(c) => <TextInput {...c} name="relation" maxLength={40} />}
          </Field>
          <Button type="submit">{T.add}</Button>
        </Form>
      </Section>

      <Section title={T.sharedTitle} description={T.sharedDesc}>
        <Card padded>
          <AnswerForm
            key={JSON.stringify(d.answers)}
            scope="case"
            answers={d.answers}
            intent="shared"
            submitLabel={actionData?.saved ? T.saved : T.save}
            errors={actionData?.errors}
          />
        </Card>
      </Section>

      <Section title={T.deleteCase} description={T.deleteCaseDesc}>
        <Form method="post" onSubmit={confirmSubmit(T.confirmDeleteCase)}>
          <input type="hidden" name="intent" value="deleteCase" />
          <Button type="submit" variant="ghost">
            {T.deleteCase}
          </Button>
        </Form>
      </Section>
    </PageWindow>
  );
}
