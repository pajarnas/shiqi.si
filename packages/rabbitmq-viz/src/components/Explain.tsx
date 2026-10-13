import { Explain as LabExplain } from '@shiqi/lab';
import { useRabbitStrings } from '../i18n';

/** Text from RABBIT_STRINGS with its markup and glossary terms. */
export function Explain({ text, vars }: { text: string; vars?: Record<string, string | number> }) {
  const t = useRabbitStrings();
  return <LabExplain text={text} vars={vars} glossary={t.glossary} />;
}
