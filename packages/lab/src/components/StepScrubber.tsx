import { Button, Checkbox, cx, format, Range } from '@shiqi/ui';
import { preciseClock } from '../format';
import type { LabStrings } from '../strings';

const EPSILON = 1e-6;
/** Marks closer than this (share of the bar) go on separate rows, so none hides another. */
const MARK_GAP = 0.09;

/** Where each mark sits along the bar (0..1) and on which row. */
export function placeMarks(marks: number[], start: number, length: number) {
  const rows: number[] = [];
  return marks.map((m) => {
    const x = (m - start) / length;
    let row = rows.findIndex((last) => x - last >= MARK_GAP);
    if (row < 0) row = rows.length;
    rows[row] = x;
    return { x, row };
  });
}

export interface StepScrubberProps {
  strings: LabStrings['loop'];
  /** The stretch of simulated time the step covered, and where we are in it. */
  start: number;
  end: number;
  now: number;
  /** When each event the story told about happened, in order. */
  marks: number[];
  /** The mark on screen, or -1. */
  active: number;
  playing: boolean;
  loop: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onLoop: (on: boolean) => void;
}

/**
 * A step played back like a short video: play or pause, drag to any moment,
 * jump from event to event (numbered as in the story), and loop.
 */
export function StepScrubber({
  strings: s,
  start,
  end,
  now,
  marks,
  active,
  playing,
  loop,
  onPlay,
  onPause,
  onSeek,
  onLoop,
}: StepScrubberProps) {
  const length = Math.max(end - start, 1);
  const at = Math.max(0, Math.min(now - start, length));
  const before = [...marks].reverse().find((m) => m < now - EPSILON);
  const after = marks.find((m) => m > now + EPSILON);
  const placed = placeMarks(marks, start, length);
  const rows = Math.max(1, ...placed.map((p) => p.row + 1));
  return (
    <section className="lab-loop" aria-label={s.label}>
      <h4 className="lab-loop__title">{s.label}</h4>
      <div className="lab-loop__bar">
        <Range
          className="lab-loop__range"
          aria-label={s.scrub}
          title={s.scrub}
          min={0}
          max={length}
          step="any"
          value={at}
          onChange={(e) => onSeek(start + Number(e.target.value))}
        />
        {marks.length > 0 && (
          <ol className="lab-loop__marks" style={{ height: `${rows * 1.75}rem` }}>
            {marks.map((m, i) => (
              <li
                key={i}
                style={{
                  left: `${(placed[i]?.x ?? 0) * 100}%`,
                  top: `${(placed[i]?.row ?? 0) * 1.75}rem`,
                }}
              >
                <button
                  type="button"
                  className={cx('lab-loop__mark', i === active && 'lab-loop__mark--on')}
                  aria-label={format(s.mark, { n: i + 1 })}
                  title={format(s.mark, { n: i + 1 })}
                  onClick={() => onSeek(m)}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="lab-loop__controls">
        <Button size="sm" variant="ghost" onClick={() => onSeek(before ?? start)}>
          {s.prev}
        </Button>
        <Button size="sm" onClick={playing ? onPause : onPlay}>
          {playing ? s.pause : s.play}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSeek(after ?? end)}>
          {s.next}
        </Button>
        <span className="lab-loop__time ui-pixel">
          {format(s.position, { now: preciseClock(at), total: preciseClock(length) })}
        </span>
        <Checkbox label={s.loop} checked={loop} onChange={(e) => onLoop(e.target.checked)} />
      </div>
    </section>
  );
}
