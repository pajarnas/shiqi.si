import { Checkbox, cx } from '@shiqi/ui';
import { useState } from 'react';
import { clock } from '../format';
import type { LabStrings } from '../strings';

export interface EventListProps<E extends { at: number }> {
  strings: LabStrings['events'];
  events: readonly E[];
  /** Per-message traffic, hidden unless the box is ticked. */
  isData: (e: E) => boolean;
  describe: (e: E) => string;
  tone?: (e: E) => 'good' | 'bad' | undefined;
  shown?: number;
}

/** The event log, newest first. */
export function EventList<E extends { at: number }>({
  strings: t,
  events,
  isData,
  describe,
  tone,
  shown = 80,
}: EventListProps<E>) {
  const [data, setData] = useState(false);
  const list = events
    .filter((e) => data || !isData(e))
    .slice(-shown)
    .reverse();
  return (
    <div className="lab-events">
      <Checkbox label={t.showData} checked={data} onChange={(e) => setData(e.target.checked)} />
      {list.length === 0 ? (
        <p className="lab-muted">{t.empty}</p>
      ) : (
        <ol className="lab-events__list">
          {list.map((e, i) => {
            const k = tone?.(e);
            return (
              <li key={`${e.at}-${i}`} className={cx(k && `lab-events__item--${k}`)}>
                <time>{clock(e.at)}</time> {describe(e)}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
