// How an exchange picks queues, as RabbitMQ's exchange types do it.
// https://www.rabbitmq.com/tutorials/amqp-concepts#exchanges

export type ExchangeType = 'direct' | 'fanout' | 'topic' | 'headers';

export const EXCHANGE_TYPES: readonly ExchangeType[] = ['direct', 'fanout', 'topic', 'headers'];

/**
 * Topic patterns: words split by dots; `*` matches exactly one word, `#`
 * matches zero or more. `#` alone matches everything, like fanout.
 */
export function topicMatches(pattern: string, key: string): boolean {
  const p = pattern === '' ? [] : pattern.split('.');
  const k = key === '' ? [] : key.split('.');
  // match(i, j): pattern words from i match key words from j.
  const memo = new Map<number, boolean>();
  const match = (i: number, j: number): boolean => {
    const id = i * (k.length + 1) + j;
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    let ok: boolean;
    if (i === p.length) ok = j === k.length;
    else if (p[i] === '#') ok = match(i + 1, j) || (j < k.length && match(i, j + 1));
    else ok = j < k.length && (p[i] === '*' || p[i] === k[j]) && match(i + 1, j + 1);
    memo.set(id, ok);
    return ok;
  };
  return match(0, 0);
}

/**
 * Headers exchange: the binding's arguments are the headers to look for.
 * `x-match` is `all` (the default) or `any`; other `x-` arguments are ignored.
 */
export function headersMatch(args: Record<string, string>, headers: Record<string, string>) {
  const mode = args['x-match'] ?? 'all';
  const wanted = Object.entries(args).filter(([k]) => !k.startsWith('x-'));
  if (!wanted.length) return mode === 'all';
  const hit = ([k, v]: [string, string]) => headers[k] === v;
  return mode === 'any' ? wanted.some(hit) : wanted.every(hit);
}

/** Does a binding of this exchange type let the message through? */
export function bindingMatches(
  type: ExchangeType,
  binding: { routingKey: string; args: Record<string, string> },
  key: string,
  headers: Record<string, string>,
): boolean {
  switch (type) {
    case 'fanout':
      return true;
    case 'direct':
      return binding.routingKey === key;
    case 'topic':
      return topicMatches(binding.routingKey, key);
    case 'headers':
      return headersMatch(binding.args, headers);
  }
}
