import { Button, Checkbox } from '@shiqi/ui';
import { eventVars, type Beat } from '../story';
import type { StoryPhase } from '../hooks/useStory';
import { format, useKafkaStrings, type KafkaStrings } from '../strings';
import { Explain } from './Explain';

/** The words for one beat: what happened and why it matters. */
function beatVars(b: Beat, t: KafkaStrings): Record<string, string | number> {
  const v = eventVars(b.event);
  const e = b.event;
  if (e.type === 'rebalance-start') v.reason = t.events.reasons[e.reason];
  if (e.type === 'ack' && e.error)
    v.reason = (t.story.errors as Record<string, string>)[e.error] ?? t.story.errors.other;
  return v;
}

function BeatText({ beat, t }: { beat: Beat; t: KafkaStrings }) {
  const words = t.story.beats[beat.kind];
  const vars = beatVars(beat, t);
  return (
    <>
      <b className="kv-story__beat-title">
        <Explain text={words.title} vars={vars} />
      </b>
      <p>
        <Explain text={words.body} vars={vars} />
      </p>
    </>
  );
}

export interface StoryProps {
  phase: StoryPhase;
  beats: Beat[];
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
export function Story({ phase, beats, quiet, auto, onAuto, onNext, onSkip }: StoryProps) {
  const t = useKafkaStrings();
  const s = t.story;
  if (phase === 'ready') return null;
  const live = phase !== 'done';
  return (
    <section className="kv-story" aria-label={s.title}>
      <h4 className="kv-story__title">{s.title}</h4>
      {beats.length > 0 && (
        <ol className="kv-story__list">
          {beats.map((b, i) => {
            const last = i === beats.length - 1;
            return last && phase === 'paused' ? (
              <li key={i} className="kv-story__now" aria-live="polite">
                <span className="kv-story__n">{i + 1}</span>
                <div>
                  <BeatText beat={b} t={t} />
                </div>
              </li>
            ) : (
              <li key={i}>
                <span className="kv-story__n">{i + 1}</span>
                <details open={!live && last}>
                  <summary>
                    <Explain text={t.story.beats[b.kind].title} vars={beatVars(b, t)} />
                  </summary>
                  <p>
                    <Explain text={t.story.beats[b.kind].body} vars={beatVars(b, t)} />
                  </p>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {phase === 'playing' && <p className="kv-muted">{s.waiting}</p>}
      {phase === 'done' && beats.length === 0 && <p className="kv-muted">{s.none}</p>}
      {phase === 'done' && quiet > 0 && <p className="kv-muted">{format(s.quiet, { n: quiet })}</p>}
      {live && (
        <div className="kv-story__controls">
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
