import { useId, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { format, useUiStrings } from '../strings';

export interface QuizQuestion {
  q: string;
  options: readonly string[];
  /** Index of the correct option. */
  answer: number;
  explain?: string;
}

export interface QuizProps {
  title?: string;
  questions: readonly QuizQuestion[];
}

export interface QuestionProps {
  question: QuizQuestion;
  /**
   * Show the answer. Leave it out and Check reveals it at once; pass it to
   * reveal later, e.g. after a simulation has played out what was predicted.
   */
  revealed?: boolean;
  /** Called when the reader commits to an option. */
  onCheck?: (picked: number) => void;
  checkLabel?: string;
  /** Shown once the answer is revealed, under the explanation (a Next button, say). */
  children?: ReactNode;
}

/** One multiple-choice question: pick, commit, then see which was right and why. */
export function Question({ question: q, revealed, onCheck, checkLabel, children }: QuestionProps) {
  const s = useUiStrings();
  const name = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const shown = checked && (revealed ?? true);

  const check = () => {
    if (picked === null) return;
    setChecked(true);
    onCheck?.(picked);
  };

  return (
    <>
      <fieldset className="ui-quiz__options">
        <legend className="ui-quiz__q">{q.q}</legend>
        {q.options.map((opt, i) => {
          const state = shown
            ? i === q.answer
              ? 'correct'
              : i === picked
                ? 'wrong'
                : undefined
            : undefined;
          return (
            <label key={i} className="ui-quiz__option" data-state={state}>
              <input
                type="radio"
                name={name}
                checked={picked === i}
                disabled={checked}
                onChange={() => setPicked(i)}
              />
              {opt}
            </label>
          );
        })}
      </fieldset>
      {shown && q.explain && <p className="ui-quiz__explain">{q.explain}</p>}
      {!checked && (
        <div>
          <Button onClick={check} disabled={picked === null}>
            {checkLabel ?? s.quiz.check}
          </Button>
        </div>
      )}
      {shown && children}
    </>
  );
}

/** One question at a time: pick, check, see why, move on. Score at the end. */
export function Quiz({ title, questions }: QuizProps) {
  const s = useUiStrings();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const done = index >= questions.length;
  const q = questions[index];

  const restart = () => {
    setIndex(0);
    setScore(0);
  };

  if (done || !q) {
    return (
      <Card className="ui-quiz">
        <div className="ui-quiz__progress">
          <span>{title ?? s.quiz.title}</span>
          <span>DONE</span>
        </div>
        <p className="ui-quiz__q">
          {format(s.quiz.score, { score, total: questions.length })}
          {score === questions.length ? s.quiz.perfect : ''}
        </p>
        <div>
          <Button onClick={restart}>{s.quiz.retry}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="ui-quiz">
      <div className="ui-quiz__progress">
        <span>{title ?? s.quiz.title}</span>
        <span>
          {index + 1} / {questions.length}
        </span>
      </div>
      <Question
        key={index}
        question={q}
        onCheck={(picked) => picked === q.answer && setScore((n) => n + 1)}
      >
        <div>
          <Button onClick={() => setIndex((i) => i + 1)}>
            {index + 1 === questions.length ? s.quiz.results : s.quiz.next}
          </Button>
        </div>
      </Question>
    </Card>
  );
}
