import { buildSheet, STEPS, transcript } from '@shiqi/visa/forms';
import { Button, Card, Section } from '@shiqi/ui';
import { Form, Link, data } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { SheetView } from '~/features/visa/components';
import { VISA_TEXT as T } from '~/features/visa/text';
import { adminOnly, getVisa, PRIVATE_HEADERS } from '~/features/visa/visa.server';
import type { Route } from './+types/admin-sheet';

export const meta = () => [{ title: `DS-160 · shiqi.si` }, { name: 'robots', content: 'noindex' }];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? PRIVATE_HEADERS;
}

async function load(request: Request, id: string) {
  adminOnly(request);
  const visa = await getVisa();
  if (!visa) throw data(null, { status: 503 });
  const a = await visa.store.getApplicant(Number(id));
  if (!a) throw data(null, { status: 404 });
  const c = await visa.store.getCase(a.caseId);
  return { visa, a, caseAnswers: c?.answers ?? {} };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { a, caseAnswers } = await load(request, params.id);
  return {
    caseId: a.caseId,
    name: a.profile.name,
    visa: a.profile.visa,
    status: a.status,
    sheet: buildSheet(a.profile.visa, caseAnswers, a.answers),
    answersZh: a.answersZh,
    chat: transcript(a.messages),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { visa, a } = await load(request, params.id);
  const form = await request.formData();
  if (form.get('intent') === 'reopen')
    await visa.store.saveApplicant({ ...a, status: 'collecting' });
  return null;
}

export default function VisaSheet({ loaderData: d }: Route.ComponentProps) {
  return (
    <PageWindow
      file={`${T.file}/ds-160`}
      eyebrow={T.eyebrow}
      title={T.sheetTitle(d.name)}
      lede={T.sheetLede}
    >
      <div className="visa__actions visa__no-print">
        <Link to={`/admin/visa/case/${d.caseId}`}>← {T.applicantsTitle}</Link>
        <Button type="button" size="sm" onClick={() => window.print()}>
          {T.print}
        </Button>
        {d.status !== 'collecting' && (
          <Form method="post">
            <input type="hidden" name="intent" value="reopen" />
            <Button type="submit" variant="secondary" size="sm">
              {T.reopen}
            </Button>
          </Form>
        )}
        <span>
          {T.status[d.status]} · {d.sheet.missing > 0 ? T.missingCount(d.sheet.missing) : null}
        </span>
      </div>

      <SheetView sheet={d.sheet} answersZh={d.answersZh} />

      <Section title="提交步骤">
        <Card padded>
          <ol>
            {STEPS[d.visa].map((s) => (
              <li key={s.title.en}>
                <strong>{s.title.zh}</strong> {s.zh}
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      <Section title={T.transcriptTitle} className="visa__no-print">
        <Card padded className="visa__chat">
          {d.chat.map((m, i) => (
            <p key={i} className={`visa__bubble visa__bubble--${m.role}`}>
              {m.text}
            </p>
          ))}
        </Card>
      </Section>
    </PageWindow>
  );
}
