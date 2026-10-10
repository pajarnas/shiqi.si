// Shared plumbing for the /api/kafka routes: finding the cluster, timeouts,
// admin checks, rate limits, and turning failures into JSON.
import { rateLimiter } from '~/lib/rate-limit.server';
import { within } from '~/lib/redis.server';
import { requireAdmin } from '~/features/visits/auth.server';
import { clientIp } from '~/features/visits/visits';
import { KAFKA_TIMEOUT_MS, type KafkaPort, getKafka } from './client.server';
import { UNAVAILABLE } from './snapshot';
import { KAFKA_API_TEXT } from './text';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (body: unknown, status = 200, headers: HeadersInit = NO_STORE) =>
  Response.json(body, { status, headers });

export const unavailable = () => json(UNAVAILABLE, 503);
export const badRequest = (error: string, status = 400) => json({ error }, status);

/** Error codes for a cluster that answered "no", as opposed to one that didn't answer. */
const REFUSED = new Set(['PLT_KFK_RESPONSE', 'PLT_KFK_PROTOCOL', 'PLT_KFK_USER']);

interface KafkaError {
  code?: string;
  apiId?: string;
  message?: string;
  errors?: unknown[];
}

/**
 * Why the cluster refused, e.g. "TOPIC_ALREADY_EXISTS", or null if the error
 * isn't a refusal. The client nests errors (MultipleErrors > ResponseError >
 * ProtocolError), so this looks all the way down.
 */
export function refusal(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as KafkaError;
  for (const inner of e.errors ?? []) {
    const why = refusal(inner);
    if (why) return why;
  }
  if (e.code && REFUSED.has(e.code)) return e.apiId ?? e.message ?? e.code;
  return null;
}

/**
 * Runs `task` against the cluster with a time limit. No cluster, or one that
 * doesn't answer, is a 503 { available: false }; a refusal is a 400 with the reason.
 */
export async function withKafka(
  task: (port: KafkaPort) => Promise<Response>,
  port: KafkaPort | null = getKafka(),
  ms = KAFKA_TIMEOUT_MS * 2,
): Promise<Response> {
  if (!port) return unavailable();
  try {
    return await within(task(port), ms);
  } catch (err) {
    const why = refusal(err);
    if (why) return json({ error: KAFKA_API_TEXT.failed, detail: why }, 400);
    console.warn('[kafka]', err);
    return unavailable();
  }
}

const publicLimit = rateLimiter(120, 60_000);
const adminLimit = rateLimiter(30, 60_000);

/** Public reads: a generous per-IP limit. Null when the request may pass. */
export function limitPublic(request: Request): Response | null {
  return publicLimit.take(clientIp(request.headers))
    ? null
    : badRequest(KAFKA_API_TEXT.tooMany, 429);
}

/**
 * Admin writes: the /admin password (HTTP Basic), JSON bodies only (a
 * cross-site form can't send one, so a remembered password can't be abused
 * from another page), and a per-IP limit. Null when the request may pass.
 */
export function guardAdminWrite(request: Request, needsBody = true): Response | null {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (needsBody && !request.headers.get('content-type')?.startsWith('application/json'))
    return badRequest(KAFKA_API_TEXT.jsonOnly, 415);
  if (!adminLimit.take(clientIp(request.headers))) return badRequest(KAFKA_API_TEXT.tooMany, 429);
  return null;
}

/** The request's JSON body, or undefined when it isn't JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
