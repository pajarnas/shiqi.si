import type { ReactNode } from 'react';
import { useClipboard } from '../hooks/useClipboard';
import { useUiStrings } from '../strings';

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const copy = useClipboard();
  const s = useUiStrings();
  return (
    <button type="button" className="ui-copy" onClick={() => void copy(text)}>
      {label ?? s.copy}
    </button>
  );
}

export interface OutputRow {
  label: ReactNode;
  value: string;
}

/** Key / value / copy rows for tool results. */
export function OutputList({ rows }: { rows: readonly OutputRow[] }) {
  return (
    <dl className="ui-output">
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
          <dd>
            <CopyButton text={r.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
