import { Segmented } from '@shiqi/ui';
import type { ReactNode } from 'react';

export interface LabPanelsProps<P extends string> {
  label: string;
  panels: readonly P[];
  names: Record<P, string>;
  value: P;
  onChange: (p: P) => void;
  children: ReactNode;
}

/** A row of tabs over one panel body. */
export function LabPanels<P extends string>({
  label,
  panels,
  names,
  value,
  onChange,
  children,
}: LabPanelsProps<P>) {
  return (
    <div className="lab-panels">
      <Segmented
        label={label}
        options={panels.map((p) => ({ value: p, label: names[p] }))}
        value={value}
        onChange={onChange}
      />
      <div className="lab-panels__body">{children}</div>
    </div>
  );
}
