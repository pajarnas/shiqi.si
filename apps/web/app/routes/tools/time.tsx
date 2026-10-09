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

export const meta = () =>
  pageMeta('时间戳', 'Unix 时间戳和 ISO 8601 互转，显示 ISO 周和相对时间。');

export default function TimeTool() {
  const mounted = useMounted();
  const [input, setInput] = useState('');
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);

  const parsed = input ? parseInstant(input) : null;
  const target = input ? parsed?.date : now;

  return (
    <PageWindow
      file="tools/time"
      eyebrow="TIME"
      title="时间戳"
      lede="粘贴 Unix 秒、毫秒或任何 ISO 8601 时间。留空就显示现在。"
    >
      <Stack gap={5}>
        <Field
          label="输入"
          hint="12 位及以上的数字按毫秒处理。"
          error={
            input && !parsed ? '看不懂这个时间。试试 1760000000 或 2026-10-09T12:00:00Z' : undefined
          }
        >
          {(p) => (
            <TextInput
              {...p}
              value={input}
              placeholder="1760000000 或 2026-10-09T12:00:00+08:00"
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
            填入现在
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setInput('')}>
            清空
          </Button>
        </Cluster>
        <Card>
          {mounted && target ? (
            <OutputList rows={formatInstant(target, now)} />
          ) : (
            <p style={{ padding: '1rem' }}>…</p>
          )}
        </Card>
      </Stack>
    </PageWindow>
  );
}
