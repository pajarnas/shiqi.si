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

export const meta = () =>
  pageMeta('UUID', '生成 UUID v4 / v7（RFC 9562），解析任意 UUID 的版本、变体和时间。');

type Version = 'v7' | 'v4';

export default function UuidTool() {
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
    <PageWindow
      file="tools/uuid"
      eyebrow="UUID"
      title="UUID"
      lede="v7 以毫秒时间戳开头，按时间排序，适合做数据库主键；v4 全随机。"
    >
      <Stack gap={5}>
        <Cluster gap={4}>
          <Segmented
            label="版本"
            value={version}
            onChange={setVersion}
            options={[
              { value: 'v7', label: 'v7' },
              { value: 'v4', label: 'v4' },
            ]}
          />
          <label className="ui-cluster" style={{ minWidth: '12rem' }}>
            <span className="ui-field__label">数量 {count}</span>
            <Range
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </label>
          <Button onClick={generate}>再来一批</Button>
          <CopyButton text={ids.join('\n')} label="全部复制" />
        </Cluster>
        <Card>
          <pre className="uuid-list">{mounted ? ids.join('\n') : '…'}</pre>
        </Card>
        <Field label="解析一个 UUID" error={probe && !info ? '不是合法的 UUID' : undefined}>
          {(p) => (
            <TextInput
              {...p}
              value={probe}
              placeholder="粘贴任意 UUID"
              onChange={(e) => setProbe(e.target.value)}
            />
          )}
        </Field>
        {info && (
          <Card>
            <OutputList
              rows={[
                { label: '规范形式', value: info.canonical },
                { label: '版本', value: `v${info.version}` },
                { label: '变体', value: info.variant },
                ...(info.time ? [{ label: '创建时间 (UTC)', value: info.time.toISOString() }] : []),
              ]}
            />
          </Card>
        )}
      </Stack>
    </PageWindow>
  );
}
