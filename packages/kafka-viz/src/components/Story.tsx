import { eventVars, type Beat } from '../story';
import type { BeatWords } from '@shiqi/lab';
import type { KafkaStrings } from '../strings';
import { Explain } from './Explain';

/** The values a beat's text fills in: the event's fields, with reasons in words. */
function beatVars(b: Beat, t: KafkaStrings): Record<string, string | number> {
  const v = eventVars(b.event);
  const e = b.event;
  if (e.type === 'rebalance-start') v.reason = t.events.reasons[e.reason];
  if (e.type === 'ack' && e.error)
    v.reason = (t.story.errors as Record<string, string>)[e.error] ?? t.story.errors.other;
  return v;
}

/** One beat in words: what happened and why it matters. */
export function beatWords(b: Beat, t: KafkaStrings): BeatWords {
  const words = t.story.beats[b.kind];
  const vars = beatVars(b, t);
  return {
    title: <Explain text={words.title} vars={vars} />,
    body: <Explain text={words.body} vars={vars} />,
  };
}
