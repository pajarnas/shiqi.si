// What a guided scenario is, whatever it simulates: steps that each do
// something, play for a while, and maybe ask for a prediction first.

export interface LabStep<S> {
  /** Key of the step's text. */
  id: string;
  /** Done when the step plays, through the timeline, so a rewind undoes it. */
  act?: (s: S) => void;
  /** Then play until this holds... */
  until?: (s: S) => boolean;
  /** ...or for this long (also the cap for `until`). */
  runMs?: number;
  /** Index of the right option when the step asks for a prediction first. */
  answer?: number;
  /** Values for placeholders in the step's text. */
  vars?: (s: S) => Record<string, string | number>;
  /** What must be true once the step has played; tests hold every story to it. */
  expect?: (s: S) => boolean;
}

export interface LabScenario<S, Id extends string = string> {
  id: Id;
  /** Builds the starting world. Deterministic, like everything else. */
  build: () => S;
  steps: LabStep<S>[];
  /** Where the story comes from (a key into the lab's sources). */
  source?: string;
  /** A scenario that carries the story on. */
  next?: Id;
}

/** The words of one step. */
export interface StepText {
  title: string;
  body: string;
  result: string;
  question?: string;
  options?: string[];
}

const DEFAULT_RUN_MS = 20_000;

/** How long a step plays at most; 0 for a step that only tells. */
export const stepRunLimit = (s: Pick<LabStep<never>, 'runMs' | 'until'>) =>
  s.runMs ?? (s.until ? DEFAULT_RUN_MS : 0);

export const isNarrative = (s: Pick<LabStep<never>, 'act' | 'runMs' | 'until'>) =>
  !s.act && stepRunLimit(s) === 0;
