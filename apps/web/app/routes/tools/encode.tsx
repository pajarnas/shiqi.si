import { Card, Field, OutputList, Segmented, Stack, TextArea } from '@shiqi/ui';
import { useEffect, useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import {
  base64Decode,
  base64Encode,
  digest,
  hexDecode,
  hexEncode,
  urlDecode,
  urlEncode,
} from '~/features/tools/encode';

export const meta = () =>
  pageMeta('编码与哈希', 'Base64、Base64URL、URL、Hex 编解码与 SHA-1/256/512 摘要。');

type Mode = 'encode' | 'decode';

function attempt(fn: () => string): string {
  try {
    return fn();
  } catch (e) {
    return `⚠ ${e instanceof Error ? e.message : '无法解码'}`;
  }
}

export default function EncodeTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [text, setText] = useState('你好，shiqi.si');
  const [hashes, setHashes] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (mode !== 'encode') return;
    let live = true;
    Promise.all(
      (['SHA-1', 'SHA-256', 'SHA-512'] as const).map(async (a) => ({
        label: a,
        value: await digest(text, a),
      })),
    ).then((rows) => {
      if (live) setHashes(rows);
    });
    return () => {
      live = false;
    };
  }, [text, mode]);

  const rows =
    mode === 'encode'
      ? [
          { label: 'Base64', value: base64Encode(text) },
          { label: 'Base64URL', value: base64Encode(text, true) },
          { label: 'URL', value: urlEncode(text) },
          { label: 'Hex', value: hexEncode(text) },
          ...hashes,
        ]
      : [
          { label: '从 Base64', value: attempt(() => base64Decode(text)) },
          { label: '从 URL', value: attempt(() => urlDecode(text)) },
          { label: '从 Hex', value: attempt(() => hexDecode(text)) },
        ];

  return (
    <PageWindow
      file="tools/encode"
      eyebrow="ENCODE"
      title="编码与哈希"
      lede="所有文本按 UTF-8 处理。哈希用浏览器自带的 Web Crypto。"
    >
      <Stack gap={5}>
        <Segmented
          label="方向"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'encode', label: '编码' },
            { value: 'decode', label: '解码' },
          ]}
        />
        <Field label={mode === 'encode' ? '原文' : '编码后的文本'}>
          {(p) => (
            <TextArea
              {...p}
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ minHeight: '7rem' }}
            />
          )}
        </Field>
        <Card>
          <OutputList rows={rows} />
        </Card>
      </Stack>
    </PageWindow>
  );
}
