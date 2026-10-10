// Partition assignment strategies, as the Java consumer's assignors implement
// them. Each maps member ids to the partitions they own.
import type { Assignor, TopicPartition } from './types';

export interface AssignInput {
  /** Member id -> topics it subscribes to. */
  members: ReadonlyMap<string, readonly string[]>;
  /** Topic -> partition count. */
  partitions: ReadonlyMap<string, number>;
  /** The assignment before this rebalance (used by sticky). */
  previous?: ReadonlyMap<string, readonly TopicPartition[]>;
}

export type Assignment = Map<string, TopicPartition[]>;

const byTp = (a: TopicPartition, b: TopicPartition) =>
  a.topic.localeCompare(b.topic) || a.partition - b.partition;

const empty = (members: Iterable<string>): Assignment =>
  new Map([...members].map((m) => [m, [] as TopicPartition[]]));

const subscribedTo = (input: AssignInput, topic: string) =>
  [...input.members].filter(([, topics]) => topics.includes(topic)).map(([m]) => m);

const allTopics = (input: AssignInput) =>
  [...new Set([...input.members.values()].flat())].filter((t) => input.partitions.has(t)).sort();

/**
 * RangeAssignor: per topic, sort members and hand out contiguous ranges; the
 * first `partitions % members` members get one extra. Many topics with few
 * partitions pile onto the first members.
 */
export function rangeAssign(input: AssignInput): Assignment {
  const out = empty(input.members.keys());
  for (const topic of allTopics(input)) {
    const members = subscribedTo(input, topic).sort();
    const count = input.partitions.get(topic) ?? 0;
    const per = Math.floor(count / members.length);
    const extra = count % members.length;
    members.forEach((m, i) => {
      const start = per * i + Math.min(i, extra);
      const len = per + (i < extra ? 1 : 0);
      for (let p = start; p < start + len; p++) out.get(m)?.push({ topic, partition: p });
    });
  }
  return out;
}

/** RoundRobinAssignor: every partition of every topic, dealt one by one around the sorted members. */
export function roundRobinAssign(input: AssignInput): Assignment {
  const out = empty(input.members.keys());
  const members = [...input.members.keys()].sort();
  let i = 0;
  for (const topic of allTopics(input)) {
    const count = input.partitions.get(topic) ?? 0;
    for (let p = 0; p < count; p++) {
      // Skip members that don't subscribe to this topic.
      for (let tries = 0; tries < members.length; tries++) {
        const m = members[i++ % members.length] as string;
        if (input.members.get(m)?.includes(topic)) {
          out.get(m)?.push({ topic, partition: p });
          break;
        }
      }
    }
  }
  return out;
}

/**
 * (Cooperative) StickyAssignor: keep every partition where it was as long as
 * the result stays balanced (sizes differ by at most one), then give the rest
 * to whoever has the fewest. Fewer moves means fewer paused partitions.
 */
export function stickyAssign(input: AssignInput): Assignment {
  const out = empty(input.members.keys());
  const all: TopicPartition[] = allTopics(input).flatMap((topic) =>
    Array.from({ length: input.partitions.get(topic) ?? 0 }, (_, partition) => ({
      topic,
      partition,
    })),
  );
  const memberCount = input.members.size;
  if (memberCount === 0) return out;
  const max = Math.ceil(all.length / memberCount);

  const taken = new Set<string>();
  const key = (tp: TopicPartition) => `${tp.topic}-${tp.partition}`;
  for (const [m, prev] of [...(input.previous ?? [])].sort(([a], [b]) => a.localeCompare(b))) {
    const mine = out.get(m);
    if (!mine) continue;
    for (const tp of [...prev].sort(byTp)) {
      const stillExists = all.some((x) => key(x) === key(tp));
      if (!stillExists || taken.has(key(tp)) || mine.length >= max) continue;
      if (!input.members.get(m)?.includes(tp.topic)) continue;
      mine.push(tp);
      taken.add(key(tp));
    }
  }

  for (const tp of all) {
    if (taken.has(key(tp))) continue;
    const candidates = [...out]
      .filter(([m]) => input.members.get(m)?.includes(tp.topic))
      .sort(([a, x], [b, y]) => x.length - y.length || a.localeCompare(b));
    const target = candidates[0];
    if (!target) continue;
    target[1].push(tp);
    taken.add(key(tp));
  }

  // Even out: move from the biggest to the smallest until sizes differ by <= 1.
  for (;;) {
    const sorted = [...out].sort(([a, x], [b, y]) => x.length - y.length || a.localeCompare(b));
    const small = sorted[0];
    const big = sorted[sorted.length - 1];
    if (!small || !big || big[1].length - small[1].length <= 1) break;
    const idx = big[1].findIndex((tp) => input.members.get(small[0])?.includes(tp.topic));
    if (idx < 0) break;
    const [moved] = big[1].splice(idx, 1);
    if (moved) small[1].push(moved);
  }

  for (const list of out.values()) list.sort(byTp);
  return out;
}

export const ASSIGNORS: Record<Assignor, (input: AssignInput) => Assignment> = {
  range: rangeAssign,
  roundrobin: roundRobinAssign,
  'cooperative-sticky': stickyAssign,
};
