import { format, Rich, Term } from '@shiqi/ui';
import { useMemo, type ReactNode } from 'react';

export type Glossary = Record<string, { term: string; def: string }>;

/**
 * Text with its markup: <b>, <code>, and glossary tags such as
 * <hw>high watermark</hw>, which become terms with their definition one hover away.
 */
export function Explain({
  text,
  vars,
  glossary,
}: {
  text: string;
  vars?: Record<string, string | number>;
  glossary: Glossary;
}) {
  const tags = useMemo(() => {
    const out: Record<string, (s: string) => ReactNode> = {
      b: (s) => <b>{s}</b>,
      code: (s) => <code>{s}</code>,
    };
    for (const [key, g] of Object.entries(glossary))
      out[key] = (s) => (
        <Term title={g.term} definition={g.def}>
          {s}
        </Term>
      );
    return out;
  }, [glossary]);
  return <Rich text={vars ? format(text, vars) : text} tags={tags} />;
}
