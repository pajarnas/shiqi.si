// The "Simulation / Real" switch on the lab pages (/kafka, /rabbitmq), kept in
// ?mode=real so a link can open the real view.
import { Segmented } from '@shiqi/ui';
import { useSearchParams } from 'react-router';

export type LabMode = 'sim' | 'real';

export function useLabMode() {
  const [params, setParams] = useSearchParams();
  const mode: LabMode = params.get('mode') === 'real' ? 'real' : 'sim';
  const setMode = (next: LabMode) =>
    setParams(next === 'real' ? { mode: 'real' } : {}, { replace: true, preventScrollReset: true });
  return [mode, setMode] as const;
}

export function LabModeSwitch({
  mode,
  onChange,
  text,
}: {
  mode: LabMode;
  onChange: (mode: LabMode) => void;
  text: { label: string; sim: string; real: string };
}) {
  const options = [
    { value: 'sim' as const, label: text.sim },
    { value: 'real' as const, label: text.real },
  ];
  return (
    <Segmented
      className="lab-mode"
      label={text.label}
      options={options}
      value={mode}
      onChange={onChange}
    />
  );
}
