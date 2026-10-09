import {
  Button,
  Card,
  Cluster,
  CopyButton,
  Field,
  OutputList,
  Range,
  Segmented,
  Stack,
  TextInput,
  useMounted,
} from '@shiqi/ui';
import { useCallback, useEffect, useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { inspectUuid, uuidv4, uuidv7 } from '~/features/tools/uuid';
import { format, useI18n } from '~/i18n';
import type { Route } from './+types/uuid';

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({ title: t.entries.uuid.title, description: t.uuid.description }));

type Version = 'v7' | 'v4';

export default function UuidTool() {
  const { t } = useI18n();
  const mounted = useMounted();
  const [version, setVersion] = useState<Version>('v7');
  const [count, setCount] = useState(5);
  const [ids, setIds] = useState<string[]>([]);
  const [probe, setProbe] = useState('');

  const generate = useCallback(() => {
    setIds(Array.from({ length: count }, () => (version === 'v7' ? uuidv7() : uuidv4())));
  }, [count, version]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- random output must be generated on the client
  useEffect(generate, [generate]);

  const info = probe ? inspectUuid(probe) : null;

  return (
    <PageWindow page="uuid" title={t.entries.uuid.title} lede={t.uuid.lede}>
      <Stack gap={5}>
        <Cluster gap={4}>
          <Segmented
            label={t.uuid.version}
            value={version}
            onChange={setVersion}
            options={[
              { value: 'v7', label: 'v7' },
              { value: 'v4', label: 'v4' },
            ]}
          />
          <label className="ui-cluster" style={{ minWidth: '12rem' }}>
            <span className="ui-field__label">{format(t.uuid.count, { n: count })}</span>
            <Range
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </label>
          <Button onClick={generate}>{t.uuid.again}</Button>
          <CopyButton text={ids.join('\n')} label={t.uuid.copyAll} />
        </Cluster>
        <Card>
          <pre className="uuid-list">{mounted ? ids.join('\n') : '…'}</pre>
        </Card>
        <Field label={t.uuid.inspect} error={probe && !info ? t.uuid.invalid : undefined}>
          {(p) => (
            <TextInput
              {...p}
              value={probe}
              placeholder={t.uuid.placeholder}
              onChange={(e) => setProbe(e.target.value)}
            />
          )}
        </Field>
        {info && (
          <Card>
            <OutputList
              rows={[
                { label: t.uuid.canonical, value: info.canonical },
                { label: t.uuid.version, value: `v${info.version}` },
                { label: t.uuid.variant, value: info.variant },
                ...(info.time ? [{ label: t.uuid.created, value: info.time.toISOString() }] : []),
              ]}
            />
          </Card>
        )}
      </Stack>
    </PageWindow>
  );
}
