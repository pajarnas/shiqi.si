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
import { format, useI18n } from '~/i18n';
import type { Route } from './+types/json';

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({ title: t.entries.json.title, description: t.json.description }));

type Indent = '2' | '4' | 'tab' | 'min';
const INDENTS = { '2': 2, '4': 4, tab: '\t', min: 0 } as const;

const SAMPLE =
  '{"site":"shiqi.si","colors":["gold","green","ink","paper"],"pixel":{"size":16,"dither":true}}';

export default function JsonTool() {
  const { t } = useI18n();
  const [input, setInput] = useState(SAMPLE);
  const [indent, setIndent] = useState<Indent>('2');
  const [sortKeys, setSortKeys] = useState(false);
  const result = formatJson(input, { indent: INDENTS[indent], sortKeys });

  return (
    <PageWindow page="json" title={t.entries.json.title} lede={t.json.lede}>
      <Stack gap={5}>
        <Cluster gap={4}>
          <Segmented
            label={t.json.indent}
            value={indent}
            onChange={setIndent}
            options={[
              { value: '2', label: format(t.json.spaces, { n: 2 }) },
              { value: '4', label: format(t.json.spaces, { n: 4 }) },
              { value: 'tab', label: t.json.tab },
              { value: 'min', label: t.json.minify },
            ]}
          />
          <Checkbox
            label={t.json.sortKeys}
            checked={sortKeys}
            onChange={(e) => setSortKeys(e.target.checked)}
          />
        </Cluster>
        <div className="two-col">
          <Field
            label={t.json.input}
            error={
              !result.ok
                ? result.line
                  ? format(t.json.errorAt, {
                      line: result.line,
                      column: result.column ?? 1,
                      error: result.error,
                    })
                  : result.error
                : undefined
            }
          >
            {(p) => <TextArea {...p} value={input} onChange={(e) => setInput(e.target.value)} />}
          </Field>
          <div className="ui-field">
            <span className="ui-field__label">{t.json.output}</span>
            <Card className="json-out">
              <pre>{result.ok ? result.text : ''}</pre>
            </Card>
          </div>
        </div>
        <Cluster>
          {result.ok && <CopyButton text={result.text} label={t.json.copy} />}
          {result.ok && (
            <Button variant="secondary" size="sm" onClick={() => setInput(result.text)}>
              {t.json.replace}
            </Button>
          )}
        </Cluster>
      </Stack>
    </PageWindow>
  );
}
