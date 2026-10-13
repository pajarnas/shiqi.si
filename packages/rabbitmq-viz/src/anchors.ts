// Ids of the cards messages fly between. The flow layer looks them up by
// these ids, so cards only need to register their element.

export const anchorId = {
  publisher: (id: string) => `publisher:${id}`,
  exchange: (name: string) => `exchange:${name}`,
  queue: (name: string) => `queue:${name}`,
  consumer: (tag: string) => `consumer:${tag}`,
};
