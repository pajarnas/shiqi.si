import { Button, Checkbox, format } from '@shiqi/ui';
import type { StoryPhase } from '@shiqi/sim/react';
import type { ReactNode } from 'react';
import type { LabStrings } from '../strings';

/** One beat, already in words. */
export interface BeatWords {
  title: ReactNode;
  body: ReactNode;
}

export interface StoryProps {
  strings: LabStrings['story'];
  phase: StoryPhase;
  beats: BeatWords[];
  quiet: number;
  auto: boolean;
  onAuto: (on: boolean) => void;
  onNext: () => void;
  onSkip: () => void;
}

/**
 * The running story of a scenario step: the beat on screen in full, earlier
 * ones folded up above it so they can be read again, and the controls.
 */
export function Story({
  strings: s,
  phase,
  beats,
  quiet,
  auto,
  onAuto,
  onNext,
  onSkip,
}: StoryProps) {
  if (phase === 'ready') return null;
  const live = phase !== 'done';
  return (
    <section className="lab-story" aria-label={s.title}>
      <h4 className="lab-story__title">{s.title}</h4>
      {beats.length > 0 && (
        <ol className="lab-story__list">
          {beats.map((b, i) => {
            const last = i === beats.length - 1;
            return last && phase === 'paused' ? (
              <li key={i} className="lab-story__now" aria-live="polite">
                <span className="lab-story__n">{i + 1}</span>
                <div>
                  <b className="lab-story__beat-title">{b.title}</b>
                  <p>{b.body}</p>
                </div>
              </li>
            ) : (
              <li key={i}>
                <span className="lab-story__n">{i + 1}</span>
                <details open={!live && last}>
                  <summary>{b.title}</summary>
                  <p>{b.body}</p>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {phase === 'playing' && <p className="lab-muted">{s.waiting}</p>}
      {phase === 'done' && beats.length === 0 && <p className="lab-muted">{s.none}</p>}
      {phase === 'done' && quiet > 0 && (
        <p className="lab-muted">{format(s.quiet, { n: quiet })}</p>
      )}
      {live && (
        <div className="lab-story__controls">
          <Button size="sm" onClick={onNext} disabled={phase !== 'paused'}>
            {s.continue}
          </Button>
          <Button size="sm" variant="ghost" onClick={onSkip}>
            {s.skip}
          </Button>
          <Checkbox label={s.auto} checked={auto} onChange={(e) => onAuto(e.target.checked)} />
        </div>
      )}
    </section>
  );
}
