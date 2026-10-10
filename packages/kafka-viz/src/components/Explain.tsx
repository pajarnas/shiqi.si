import { format, Rich, Term } from '@shiqi/ui';
import { useMemo, type ReactNode } from 'react';
import { useKafkaStrings } from '../strings';

/**
 * Text from KAFKA_STRINGS with its markup: <b>, <code>, and glossary tags
 * such as <hw>high watermark</hw>, which become terms with their definition.
 */
export function Explain({ text, vars }: { text: string; vars?: Record<string, string | number> }) {
  const t = useKafkaStrings();
  const tags = useMemo(() => {
    const out: Record<string, (s: string) => ReactNode> = {
      b: (s) => <b>{s}</b>,
      code: (s) => <code>{s}</code>,
    };
    for (const [key, g] of Object.entries(t.glossary))
      out[key] = (s) => (
        <Term title={g.term} definition={g.def}>
          {s}
        </Term>
      );
    return out;
  }, [t]);
  return <Rich text={vars ? format(text, vars) : text} tags={tags} />;
}
