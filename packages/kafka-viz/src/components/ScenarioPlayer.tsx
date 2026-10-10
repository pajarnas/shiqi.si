import { KafkaError, type Cluster, type Timeline } from '@shiqi/kafka';
import { Button, cx, Question } from '@shiqi/ui';
import { useEffect, useRef, useState } from 'react';
import {
  SCENARIO_GROUPS,
  SCENARIO_SOURCES,
  stepRunLimit,
  type Scenario,
  type ScenarioId,
  type ScenarioStep,
} from '../scenarios';
import { format, useKafkaStrings } from '../strings';
import { Explain } from './Explain';

type Phase = 'ready' | 'playing' | 'done';

export interface ScenarioPlayerProps {
  scenario: Scenario;
  cluster: Cluster;
  timeline: Timeline;
  /** Play the simulation until `until` holds, then call `done`. */
  onRun: (until: (c: Cluster) => boolean, done: () => void) => void;
  /** The step on screen changed (for highlights and the inspector). */
  onStep: (step: ScenarioStep) => void;
  onOpen: (id: ScenarioId) => void;
  onExit: () => void;
}

const isNarrative = (s: ScenarioStep) => !s.act && stepRunLimit(s) === 0;

/**
 * One scenario, a step at a time: read, guess, play, see why. Back and Replay
 * rewind the timeline to the start of a step, so every step can be retried.
 */
export function ScenarioPlayer({
  scenario,
  cluster,
  timeline,
  onRun,
  onStep,
  onOpen,
  onExit,
}: ScenarioPlayerProps) {
  const t = useKafkaStrings();
  const s = t.scenarios;
  const text = s.list[scenario.id];
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [attempt, setAttempt] = useState(0);
  /** Simulated time each step started at, for Back and Replay. */
  const starts = useRef<number[]>([]);
  const step = scenario.steps[index] as ScenarioStep;
  const words = (text.steps as Record<string, StepText>)[step.id] as StepText;
  const vars = step.vars?.(cluster);
  const last = index === scenario.steps.length - 1;
  const done = phase === 'done' || isNarrative(step);

  useEffect(() => {
    onStep(step);
  }, [step, onStep]);

  const play = () => {
    starts.current[index] = timeline.now;
    try {
      step.act?.(cluster);
    } catch (e) {
      if (!(e instanceof KafkaError)) throw e;
    }
    const limit = stepRunLimit(step);
    if (limit === 0) {
      setPhase('done');
      return;
    }
    const end = cluster.now + limit;
    setPhase('playing');
    onRun(
      (c) => c.now >= end || !!step.until?.(c),
      () => setPhase('done'),
    );
  };

  const go = (to: number, rewind: boolean) => {
    const at = starts.current[to];
    if (rewind && at !== undefined) timeline.seek(at);
    setIndex(to);
    setPhase('ready');
    setAttempt((n) => n + 1);
  };

  const nav = (
    <div className="kv-scenario__nav">
      {index > 0 && (
        <Button size="sm" variant="ghost" onClick={() => go(index - 1, true)}>
          {s.back}
        </Button>
      )}
      {!isNarrative(step) && (
        <Button size="sm" variant="ghost" onClick={() => go(index, true)}>
          {s.replay}
        </Button>
      )}
      {!last && (
        <Button size="sm" onClick={() => go(index + 1, false)}>
          {s.next}
        </Button>
      )}
      {last && scenario.next && (
        <Button size="sm" onClick={() => scenario.next && onOpen(scenario.next)}>
          {format(s.continueWith, { title: s.list[scenario.next].title })}
        </Button>
      )}
    </div>
  );

  const result = words.result ? (
    <p className="kv-scenario__result">
      <Explain text={words.result} vars={vars} />
    </p>
  ) : null;

  return (
    <section className="kv-scenario" aria-label={text.title}>
      <header className="kv-scenario__head">
        <h2 className="kv-scenario__title">{text.title}</h2>
        <Button size="sm" variant="ghost" onClick={onExit}>
          {s.exit}
        </Button>
      </header>
      <ol
        className="kv-scenario__dots"
        aria-label={format(s.progress, { n: index + 1, total: scenario.steps.length })}
      >
        {scenario.steps.map((x, i) => (
          <li
            key={x.id}
            className={cx(
              i < index && 'kv-scenario__dot--done',
              i === index && 'kv-scenario__dot--now',
            )}
          />
        ))}
      </ol>
      <p className="kv-muted">
        {format(s.progress, { n: index + 1, total: scenario.steps.length })}
      </p>
      <h3 className="kv-scenario__step">{words.title}</h3>
      <p>
        <Explain text={words.body} vars={vars} />
      </p>

      {words.question && words.options ? (
        <div className="kv-scenario__question ui-quiz">
          <Question
            key={`${scenario.id}-${index}-${attempt}`}
            question={{ q: words.question, options: words.options, answer: step.answer ?? 0 }}
            revealed={phase === 'done'}
            checkLabel={s.lockIn}
            onCheck={play}
          >
            {result}
            {nav}
          </Question>
          {phase === 'playing' && <p className="kv-muted">{s.playing}</p>}
        </div>
      ) : (
        <>
          {phase === 'ready' && !isNarrative(step) && <Button onClick={play}>{s.play}</Button>}
          {phase === 'playing' && <p className="kv-muted">{s.playing}</p>}
          {done && result}
          {done && last && !scenario.next && <p className="kv-muted">{s.finished}</p>}
          {done && nav}
        </>
      )}

      {scenario.source && (
        <p className="kv-scenario__source kv-muted">
          {s.source}{' '}
          <a href={SCENARIO_SOURCES[scenario.source]} target="_blank" rel="noreferrer">
            {s.sources[scenario.source as keyof typeof s.sources]}
          </a>
        </p>
      )}
    </section>
  );
}

interface StepText {
  title: string;
  body: string;
  result: string;
  question?: string;
  options?: string[];
}

/** Every scenario, grouped, with a Start button each. */
export function ScenarioMenu({ onOpen }: { onOpen: (id: ScenarioId) => void }) {
  const t = useKafkaStrings();
  const s = t.scenarios;
  return (
    <details className="kv-scenarios">
      <summary>{s.open}</summary>
      <p className="kv-muted">{s.intro}</p>
      {Object.entries(SCENARIO_GROUPS).map(([group, ids]) => (
        <section key={group} className="kv-scenarios__group">
          <h3>{s.groups[group as keyof typeof s.groups]}</h3>
          <ul>
            {ids.map((id) => (
              <li key={id} className="kv-scenarios__item">
                <div>
                  <b>{s.list[id].title}</b>
                  <p className="kv-muted">{s.list[id].summary}</p>
                </div>
                <Button size="sm" onClick={() => onOpen(id)}>
                  {s.start}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  );
}
