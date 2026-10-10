/**
 * Wraps `load` so callers within `ttlMs` of each other share one result, and
 * callers that arrive while it is loading share that one call. Failures are
 * not kept: the next caller tries again.
 */
export function cachedFor<T>(ttlMs: number, load: () => Promise<T>, now = Date.now) {
  let value: { at: number; result: T } | undefined;
  let pending: Promise<T> | undefined;
  return (): Promise<T> => {
    if (value && now() - value.at < ttlMs) return Promise.resolve(value.result);
    pending ??= load()
      .then((result) => {
        value = { at: now(), result };
        return result;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
