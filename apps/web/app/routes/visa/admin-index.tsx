import { progress } from '@shiqi/visa/forms';
import { Badge, Button, Card, Field, Section, TextInput } from '@shiqi/ui';
import { Form, Link, redirect } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { VISA_TEXT as T } from '~/features/visa/text';
import { adminOnly, getVisa, PRIVATE_HEADERS } from '~/features/visa/visa.server';
import type { Route } from './+types/admin-index';

export const meta = () => [
  { title: `${T.adminTitle} · shiqi.si` },
  { name: 'robots', content: 'noindex' },
];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? PRIVATE_HEADERS;
}

export async function loader({ request }: Route.LoaderArgs) {
  adminOnly(request);
  const visa = await getVisa();
  if (!visa) return { available: false as const };
  const cases = await visa.store.listCases();
  const withPeople = await Promise.all(
    cases.map(async (c) => {
      const people = await visa.store.listApplicants(c.id);
      return {
        id: c.id,
        label: c.label,
        people: people.map((p) => ({
          id: p.id,
          name: p.profile.name,
          visa: p.profile.visa,
          status: p.status,
          progress: progress(p.answers, p.profile.visa),
        })),
      };
    }),
  );
  return { available: true as const, cases: withPeople };
}

export async function action({ request }: Route.ActionArgs) {
  adminOnly(request);
  const visa = await getVisa();
  if (!visa) return null;
  const form = await request.formData();
  const label = String(form.get('label') ?? '').trim();
  if (!label) return null;
  const id = await visa.store.createCase(label.slice(0, 100));
  return redirect(`/admin/visa/case/${id}`);
}

export default function VisaAdmin({ loaderData: d }: Route.ComponentProps) {
  return (
    <PageWindow file={T.file} eyebrow={T.eyebrow} title={T.adminTitle} lede={T.adminLede}>
      {!d.available ? (
        <Card padded>{T.unavailable}</Card>
      ) : (
        <>
          <Section title={T.newCase}>
            <Form method="post" className="visa__inline">
              <Field label={T.caseLabel}>
                {(c) => <TextInput {...c} name="label" required maxLength={100} />}
              </Field>
              <Button type="submit">{T.create}</Button>
            </Form>
          </Section>
          <Section title={T.adminTitle}>
            {d.cases.length === 0 ? (
              <Card padded>{T.noCases}</Card>
            ) : (
              <div className="visa__cases">
                {d.cases.map((c) => (
                  <Card key={c.id} as={Link} to={`/admin/visa/case/${c.id}`} interactive padded>
                    <strong>{c.label}</strong>
                    <p>{T.applicantsCount(c.people.length)}</p>
                    <ul className="visa__people">
                      {c.people.map((p) => (
                        <li key={p.id}>
                          {p.name} <small>{p.visa}</small>{' '}
                          <Badge tone={p.status === 'collecting' ? 'gold' : 'green'}>
                            {T.status[p.status]}
                          </Badge>{' '}
                          {T.progress(p.progress.done, p.progress.total)}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </PageWindow>
  );
}
