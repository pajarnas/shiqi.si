import {
  Button,
  Card,
  Checkbox,
  Cluster,
  CopyButton,
  Field,
  Segmented,
  Stack,
  TextArea,
} from '@shiqi/ui';
import { useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { formatJson } from '~/features/tools/json';

export const meta = () => pageMeta('JSON', 'JSON 格式化、压缩、键排序，报错带行号列号。');

type Indent = '2' | '4' | 'tab' | 'min';
const INDENTS = { '2': 2, '4': 4, tab: '\t', min: 0 } as const;

const SAMPLE =
  '{"site":"shiqi.si","colors":["gold","green","ink","paper"],"pixel":{"size":16,"dither":true}}';

export default function JsonTool() {
  const [input, setInput] = useState(SAMPLE);
  const [indent, setIndent] = useState<Indent>('2');
  const [sortKeys, setSortKeys] = useState(false);
  const result = formatJson(input, { indent: INDENTS[indent], sortKeys });

  return (
    <PageWindow
      file="tools/json"
      eyebrow="JSON"
      title="JSON"
      lede="格式化、压缩、排序键。出错时告诉你在第几行第几列。"
    >
      <Stack gap={5}>
        <Cluster gap={4}>
          <Segmented
            label="缩进"
            value={indent}
            onChange={setIndent}
            options={[
              { value: '2', label: '2 空格' },
              { value: '4', label: '4 空格' },
              { value: 'tab', label: 'Tab' },
              { value: 'min', label: '压缩' },
            ]}
          />
          <Checkbox
            label="按键名排序"
            checked={sortKeys}
            onChange={(e) => setSortKeys(e.target.checked)}
          />
        </Cluster>
        <div className="two-col">
          <Field
            label="输入"
            error={
              !result.ok
                ? result.line
                  ? `第 ${result.line} 行第 ${result.column} 列：${result.error}`
                  : result.error
                : undefined
            }
          >
            {(p) => <TextArea {...p} value={input} onChange={(e) => setInput(e.target.value)} />}
          </Field>
          <div className="ui-field">
            <span className="ui-field__label">输出</span>
            <Card className="json-out">
              <pre>{result.ok ? result.text : ''}</pre>
            </Card>
          </div>
        </div>
        <Cluster>
          {result.ok && <CopyButton text={result.text} label="复制输出" />}
          {result.ok && (
            <Button variant="secondary" size="sm" onClick={() => setInput(result.text)}>
              用输出替换输入
            </Button>
          )}
        </Cluster>
      </Stack>
    </PageWindow>
  );
}
