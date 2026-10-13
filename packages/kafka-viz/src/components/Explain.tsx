import { Explain as LabExplain } from '@shiqi/lab';
import { useKafkaStrings } from '../strings';

/**
 * Text from KAFKA_STRINGS with its markup: <b>, <code>, and glossary tags
 * such as <hw>high watermark</hw>, which become terms with their definition.
 */
export function Explain({ text, vars }: { text: string; vars?: Record<string, string | number> }) {
  const t = useKafkaStrings();
  return <LabExplain text={text} vars={vars} glossary={t.glossary} />;
}
