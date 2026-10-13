// Plumbing shared by the JSON API routes (/api/kafka, /api/rabbitmq): JSON
// responses, the "no such service" answer, and the public per-IP read limit.
import { clientIp } from '~/features/visits/visits';
import { rateLimiter } from './rate-limit.server';

export const API_TEXT = {
  tooMany: 'too many requests, try again in a minute',
} as const;

/** What a route answers when the service behind it isn't running. */
export const UNAVAILABLE = { available: false } as const;

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (body: unknown, status = 200, headers: HeadersInit = NO_STORE) =>
  Response.json(body, { status, headers });

export const unavailable = () => json(UNAVAILABLE, 503);
export const badRequest = (error: string, status = 400) => json({ error }, status);

const publicLimit = rateLimiter(120, 60_000);

/** Public reads: a generous per-IP limit. Null when the request may pass. */
export function limitPublic(request: Request): Response | null {
  return publicLimit.take(clientIp(request.headers)) ? null : badRequest(API_TEXT.tooMany, 429);
}
