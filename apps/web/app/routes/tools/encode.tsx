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
import { useI18n, type Strings } from '~/i18n';
import type { Route } from './+types/encode';

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({ title: t.entries.encode.title, description: t.encode.description }));

type Mode = 'encode' | 'decode';

function attempt(t: Strings, fn: () => string): string {
  try {
    return fn();
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    const known = t.encode.errors[code as keyof Strings['encode']['errors']];
    return `⚠ ${known ?? (code || t.encode.cannotDecode)}`;
  }
}

export default function EncodeTool() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('encode');
  const [text, setText] = useState(t.encode.sample);
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
          { label: t.encode.fromBase64, value: attempt(t, () => base64Decode(text)) },
          { label: t.encode.fromUrl, value: attempt(t, () => urlDecode(text)) },
          { label: t.encode.fromHex, value: attempt(t, () => hexDecode(text)) },
        ];

  return (
    <PageWindow page="encode" title={t.entries.encode.title} lede={t.encode.lede}>
      <Stack gap={5}>
        <Segmented
          label={t.encode.direction}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'encode', label: t.encode.encode },
            { value: 'decode', label: t.encode.decode },
          ]}
        />
        <Field label={mode === 'encode' ? t.encode.plain : t.encode.encoded}>
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
