import type { BeatPicker, Eventful, SimEvent } from '@shiqi/sim';
import { useLoop, useStory, type LoopDriver } from '@shiqi/sim/react';
import { Button, cx, format, Question, useLocalStorage } from '@shiqi/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Beat } from '@shiqi/sim';
import {
  isNarrative,
  stepRunLimit,
  type LabScenario,
  type LabStep,
  type StepText,
} from '../scenario';
import type { LabStrings } from '../strings';
import { StepScrubber } from './StepScrubber';
import { Story, type BeatWords } from './Story';

/** How long a beat stays up when the story goes on by itself. */
const AUTO_MS = 7000;

export interface ScenarioPlayerProps<E extends SimEvent, S extends Eventful<E>, K extends string> {
  strings: LabStrings['scenarios'];
  storyStrings: LabStrings['story'];
  loopStrings: LabStrings['loop'];
  scenario: LabScenario<S>;
  /** The scenario's words: its title and each step's text by id. */
  text: { title: string; steps: Record<string, StepText> };
  sim: S;
  /** Runs the simulation for the story, rewinds for Back and Replay, and loops a played step. */
  clock: LoopDriver<S>;
  /** Picks the events the story stops at. */
  picker: () => BeatPicker<E, S, K>;
  /** One beat in words. */
  beatWords: (beat: Beat<E, K>) => BeatWords;
  /** Text with the lab's markup (bold, code, glossary terms) and placeholders. */
  explain: (text: string, vars?: Record<string, string | number>) => ReactNode;
  /** Errors an action may throw on purpose (the simulated system said no). */
  expectedError?: (e: unknown) => boolean;
  /** The source line: label and link. */
  source?: { label: string; href: string };
  /** Title of the scenario that follows, if any. */
  nextTitle?: string;
  /** Prefix of the localStorage keys for the "go on by itself" and "loop" switches. */
  storageKey: string;
  /** The step on screen changed. */
  onStep: (step: LabStep<S>) => void;
  /** What the story is pointing at right now; null to go back to the step's own focus. */
  onFocus: (ids: string[] | null) => void;
  onNext: () => void;
  onExit: () => void;
}

/**
 * One scenario, a step at a time: read, guess, play, see why. Back and Replay
 * rewind the timeline to the start of a step, so every step can be retried.
 */
export function ScenarioPlayer<E extends SimEvent, S extends Eventful<E>, K extends string>({
  strings: s,
  storyStrings,
  loopStrings,
  scenario,
  text,
  sim,
  clock,
  picker,
  beatWords,
  explain,
  expectedError,
  source,
  nextTitle,
  storageKey,
  onStep,
  onFocus,
  onNext,
  onExit,
}: ScenarioPlayerProps<E, S, K>) {
  const [index, setIndex] = useState(0);
  const story = useStory(sim, clock.run, picker);
  const phase = story.phase;
  const [auto, setAuto] = useLocalStorage(`${storageKey}:story-auto`, false);
  const [looping, setLooping] = useLocalStorage(`${storageKey}:step-loop`, true);
  const [attempt, setAttempt] = useState(0);
  /** Simulated time each step started at, for Back and Replay. */
  const starts = useRef<number[]>([]);
  const step = scenario.steps[index] as LabStep<S>;
  const words = text.steps[step.id] as StepText;
  const vars = step.vars?.(sim);
  const last = index === scenario.steps.length - 1;
  const done = phase === 'done' || isNarrative(step);

  // A played step has nothing left to do, so it can be watched again and again.
  const span =
    phase === 'done' && story.span && story.span.end > story.span.start ? story.span : null;
  const loop = useLoop(clock, span, { loop: looping });
  const replaying = !!span && (loop.playing || sim.now < span.end);
  const marks = span ? story.beats.map((b) => b.event.at) : [];
  const active = replaying ? marks.findLastIndex((at) => at <= sim.now) : -1;

  useEffect(() => {
    onStep(step);
  }, [step, onStep]);

  const current = story.current ?? story.beats[active] ?? null;
  useEffect(() => {
    onFocus(current ? current.focus : null);
  }, [current, onFocus]);

  const { next } = story;
  useEffect(() => {
    if (!auto || phase !== 'paused') return;
    const timer = setTimeout(next, AUTO_MS);
    return () => clearTimeout(timer);
  }, [auto, phase, current, next]);

  const play = () => {
    starts.current[index] = clock.now();
    story.start(
      () => {
        try {
          step.act?.(sim);
        } catch (e) {
          if (!expectedError?.(e)) throw e;
        }
      },
      { end: sim.now + stepRunLimit(step), until: step.until },
    );
  };

  const go = (to: number, rewind: boolean) => {
    // Going on starts from the end of this step, wherever its replay was.
    const at = rewind ? starts.current[to] : story.span?.end;
    loop.pause();
    story.reset();
    if (at !== undefined) clock.seek(at);
    setIndex(to);
    setAttempt((n) => n + 1);
  };

  const progress = format(s.progress, { n: index + 1, total: scenario.steps.length });

  const nav = (
    <div className="lab-scenario__nav">
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
      {last && nextTitle && (
        <Button size="sm" onClick={onNext}>
          {format(s.continueWith, { title: nextTitle })}
        </Button>
      )}
    </div>
  );

  const result = words.result ? (
    <p className="lab-scenario__result">{explain(words.result, vars)}</p>
  ) : null;

  const told = (
    <Story
      strings={storyStrings}
      phase={phase}
      beats={story.beats.map(beatWords)}
      quiet={story.quiet}
      auto={auto}
      onAuto={setAuto}
      onNext={story.next}
      onSkip={story.skip}
      active={span ? active : undefined}
    />
  );

  const scrubber = span && (
    <StepScrubber
      strings={loopStrings}
      start={span.start}
      end={span.end}
      now={sim.now}
      marks={marks}
      active={active}
      playing={loop.playing}
      loop={looping}
      onPlay={loop.play}
      onPause={loop.pause}
      onSeek={loop.seek}
      onLoop={setLooping}
    />
  );

  return (
    <section className="lab-scenario" aria-label={text.title}>
      <header className="lab-scenario__head">
        <h2 className="lab-scenario__title">{text.title}</h2>
        <Button size="sm" variant="ghost" onClick={onExit}>
          {s.exit}
        </Button>
      </header>
      <ol className="lab-scenario__dots" aria-label={progress}>
        {scenario.steps.map((x, i) => (
          <li
            key={x.id}
            className={cx(
              i < index && 'lab-scenario__dot--done',
              i === index && 'lab-scenario__dot--now',
            )}
          />
        ))}
      </ol>
      <p className="lab-muted">{progress}</p>
      <h3 className="lab-scenario__step">{words.title}</h3>
      <p>{explain(words.body, vars)}</p>

      {words.question && words.options ? (
        <div className="lab-scenario__question ui-quiz">
          <Question
            key={`${scenario.id}-${index}-${attempt}`}
            question={{
              q: format(words.question, vars ?? {}),
              options: words.options.map((o) => format(o, vars ?? {})),
              answer: step.answer ?? 0,
            }}
            revealed={phase === 'done'}
            checkLabel={s.lockIn}
            onCheck={play}
          />
          {scrubber}
          {told}
          {phase === 'done' && result}
          {phase === 'done' && nav}
        </div>
      ) : (
        <>
          {phase === 'ready' && !isNarrative(step) && <Button onClick={play}>{s.play}</Button>}
          {scrubber}
          {told}
          {done && result}
          {done && last && !nextTitle && <p className="lab-muted">{s.finished}</p>}
          {done && nav}
        </>
      )}

      {source && (
        <p className="lab-scenario__source lab-muted">
          {s.source}{' '}
          <a href={source.href} target="_blank" rel="noreferrer">
            {source.label}
          </a>
        </p>
      )}
    </section>
  );
}

export interface ScenarioMenuGroup {
  title: string;
  items: { id: string; title: string; summary: string }[];
}

/** Every scenario, grouped, with a Start button each. */
export function ScenarioMenu({
  strings: s,
  groups,
  onOpen,
}: {
  strings: LabStrings['scenarios'];
  groups: ScenarioMenuGroup[];
  onOpen: (id: string) => void;
}) {
  return (
    <details className="lab-scenarios">
      <summary>{s.open}</summary>
      {s.intro && <p className="lab-muted">{s.intro}</p>}
      {groups.map((g) => (
        <section key={g.title} className="lab-scenarios__group">
          <h3>{g.title}</h3>
          <ul>
            {g.items.map((item) => (
              <li key={item.id} className="lab-scenarios__item">
                <div>
                  <b>{item.title}</b>
                  <p className="lab-muted">{item.summary}</p>
                </div>
                <Button size="sm" onClick={() => onOpen(item.id)}>
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
