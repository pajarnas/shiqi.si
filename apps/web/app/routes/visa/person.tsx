import { buildSheet, progress } from '@shiqi/visa/forms';
import { Badge, Button, Card, Section } from '@shiqi/ui';
import { Link } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { LangToggle, SheetView, useLang } from '~/features/visa/components';
import { DocumentList } from '~/features/visa/guide';
import { loadPerson, PRIVATE_HEADERS } from '~/features/visa/visa.server';
import type { Route } from './+types/person';

export const meta = ({ loaderData: d }: Route.MetaArgs) => [
  { title: d ? `${d.name} · ${d.visa}` : '美签助手' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? PRIVATE_HEADERS;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { a, caseAnswers } = await loadPerson(request, params.id);
  return {
    id: a.id,
    ...a.profile,
    status: a.status,
    progress: progress(a.answers, a.profile.visa),
    sheet: buildSheet(a.profile.visa, caseAnswers, a.answers),
    answersZh: a.answersZh,
  };
}

export default function VisaPerson({ loaderData: d }: Route.ComponentProps) {
  const [lang, t, setLang] = useLang();
  const done = d.sheet.missing === 0;
  return (
    <PageWindow
      file={`visa/${d.id}`}
      eyebrow={`${d.relation} · ${d.visa}`}
      title={d.name}
      lede={t.showcaseLede}
    >
      <div className="visa__bar visa__no-print">
        <Link to="/visa">← {t.backHome}</Link>
        <LangToggle lang={lang} onChange={setLang} />
      </div>
      <div className="visa__actions visa__no-print">
        <Badge tone={done ? 'green' : 'gold'}>
          {done ? t.complete : t.missingCount(d.sheet.missing)}
        </Badge>
        <span>
          {t.progress} {d.progress.done}/{d.progress.total} · {t.status[d.status]}
        </span>
        <Button as={Link} to={`/chat/visa/${d.id}`} size="sm">
          {t.openChat}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>
          {t.print}
        </Button>
      </div>
      {done && (
        <Card padded className="visa__done">
          {t.allDone}
        </Card>
      )}

      <SheetView sheet={d.sheet} answersZh={d.answersZh} lang={lang} />

      <Section title={t.checklist}>
        <Card padded>
          <DocumentList visa={d.visa} lang={lang} />
        </Card>
      </Section>
    </PageWindow>
  );
}
