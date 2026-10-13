import { Button, format, Range, Segmented } from '@shiqi/ui';
import type { ReactNode } from 'react';
import { clock } from '../format';
import type { LabStrings } from '../strings';
import { useLabLock } from './LabLock';

export const SPEEDS = ['0.25', '0.5', '1', '2', '4'] as const;
export type Speed = (typeof SPEEDS)[number];

export interface LabToolbarProps {
  strings: LabStrings['toolbar'];
  running: boolean;
  onRunning: (running: boolean) => void;
  /** Advance one step while paused. */
  onStep: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  /** Simulated now, the furthest point reached, and the step size for the slider. */
  now: number;
  end: number;
  stepMs: number;
  rewound: boolean;
  onSeek: (time: number) => void;
  onReset: () => void;
  /** Badges after the clock (e.g. "acked records lost"). */
  children?: ReactNode;
}

/**
 * Play, step, speed, the rewind slider and the clock. Under a LabLock only
 * speed and Reset stay on: something else (a story) owns the clock.
 */
export function LabToolbar({
  strings: t,
  running,
  onRunning,
  onStep,
  speed,
  onSpeed,
  now,
  end,
  stepMs,
  rewound,
  onSeek,
  onReset,
  children,
}: LabToolbarProps) {
  const { locked, note } = useLabLock();
  return (
    <>
      <div className="lab-toolbar">
        <Button size="sm" disabled={locked} onClick={() => onRunning(!running)}>
          {running ? t.pause : t.play}
        </Button>
        <Button size="sm" variant="secondary" disabled={locked || running} onClick={onStep}>
          {t.step}
        </Button>
        <Segmented
          label={t.speed}
          options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))}
          value={speed}
          onChange={onSpeed}
        />
        <Range
          className="lab-toolbar__timeline"
          aria-label={t.timeline}
          title={t.timeline}
          min={0}
          max={Math.max(end, 1)}
          step={stepMs}
          value={now}
          disabled={locked}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <span className="lab-toolbar__clock ui-pixel">{format(t.clock, { time: clock(now) })}</span>
        {rewound && !locked && (
          <Button size="sm" variant="ghost" onClick={() => onSeek(end)}>
            {t.goLive}
          </Button>
        )}
        {children}
        <Button size="sm" variant="ghost" onClick={onReset}>
          {t.reset}
        </Button>
      </div>
      {locked ? (
        <p className="lab-muted lab-toolbar__note">{note}</p>
      ) : (
        rewound && <p className="lab-muted lab-toolbar__note">{t.rewound}</p>
      )}
    </>
  );
}
