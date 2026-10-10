// Ids of the on-screen things records fly between. The packet layer looks
// them up by these ids, so cards only need to register their element.

export const anchorId = {
  producer: (id: string) => `producer:${id}`,
  replica: (topic: string, partition: number, broker: number) =>
    `replica:${topic}:${partition}:${broker}`,
  broker: (id: number) => `broker:${id}`,
  member: (group: string, member: string) => `member:${group}:${member}`,
  group: (group: string) => `group:${group}`,
};

export type AnchorRegistry = Map<string, HTMLElement>;

/** A ref callback that keeps `registry` up to date for `id`. */
export function anchorRef(registry: AnchorRegistry, id: string) {
  return (el: HTMLElement | null) => {
    if (el) registry.set(id, el);
    else registry.delete(id);
  };
}
