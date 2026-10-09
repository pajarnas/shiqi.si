import {
  Button,
  Card,
  Cluster,
  Field,
  OutputList,
  Stack,
  TextInput,
  useInterval,
  useMounted,
} from '@shiqi/ui';
import { useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { formatInstant, parseInstant } from '~/features/tools/time';
import { useI18n } from '~/i18n';
import type { Route } from './+types/time';

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({ title: t.entries.time.title, description: t.time.description }));

export default function TimeTool() {
  const { t, lang } = useI18n();
  const mounted = useMounted();
  const [input, setInput] = useState('');
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);

  const parsed = input ? parseInstant(input) : null;
  const target = input ? parsed?.date : now;

  return (
    <PageWindow page="time" title={t.entries.time.title} lede={t.time.lede}>
      <Stack gap={5}>
        <Field
          label={t.time.input}
          hint={t.time.hint}
          error={input && !parsed ? t.time.error : undefined}
        >
          {(p) => (
            <TextInput
              {...p}
              value={input}
              placeholder={t.time.placeholder}
              onChange={(e) => setInput(e.target.value)}
            />
          )}
        </Field>
        <Cluster>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          >
            {t.time.now}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setInput('')}>
            {t.time.clear}
          </Button>
        </Cluster>
        <Card>
          {mounted && target ? (
            <OutputList rows={formatInstant(target, now, t.time.rows, lang)} />
          ) : (
            <p style={{ padding: '1rem' }}>…</p>
          )}
        </Card>
      </Stack>
    </PageWindow>
  );
}
