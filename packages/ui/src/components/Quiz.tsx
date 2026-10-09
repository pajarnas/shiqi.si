import { useId, useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';

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

/** One question at a time: pick, check, see why, move on. Score at the end. */
export function Quiz({ title = '小测验', questions }: QuizProps) {
  const name = useId();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const done = index >= questions.length;
  const q = questions[index];

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setChecked(false);
    setScore(0);
  };

  if (done || !q) {
    return (
      <Card className="ui-quiz">
        <div className="ui-quiz__progress">
          <span>{title}</span>
          <span>DONE</span>
        </div>
        <p className="ui-quiz__q">
          答对 {score} / {questions.length}
          {score === questions.length ? '，满分！' : ''}
        </p>
        <div>
          <Button onClick={restart}>再来一次</Button>
        </div>
      </Card>
    );
  }

  const check = () => {
    if (picked === null) return;
    setChecked(true);
    if (picked === q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    setIndex((i) => i + 1);
    setPicked(null);
    setChecked(false);
  };

  return (
    <Card className="ui-quiz">
      <div className="ui-quiz__progress">
        <span>{title}</span>
        <span>
          {index + 1} / {questions.length}
        </span>
      </div>
      <fieldset className="ui-quiz__options">
        <legend className="ui-quiz__q">{q.q}</legend>
        {q.options.map((opt, i) => {
          const state = checked
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
      {checked && q.explain && <p className="ui-quiz__explain">{q.explain}</p>}
      <div>
        {checked ? (
          <Button onClick={next}>{index + 1 === questions.length ? '看结果' : '下一题'}</Button>
        ) : (
          <Button onClick={check} disabled={picked === null}>
            检查答案
          </Button>
        )}
      </div>
    </Card>
  );
}
