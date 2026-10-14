import { createHash, timingSafeEqual } from 'node:crypto';
import { rateLimiter } from '~/lib/rate-limit.server';
import { clientIp } from './visits';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Wrong admin passwords: 10 per address, and 100 from everyone together (a
 * guesser spread over many addresses), per 15 minutes, then the admin pages
 * answer 429 until the window ends.
 */
const failsByIp = rateLimiter(10, 15 * 60_000);
const failsAll = rateLimiter(100, 15 * 60_000);

/**
 * HTTP Basic auth against ADMIN_PASSWORD (any user name). Returns null when the
 * request may pass, otherwise the response to send instead. Without
 * ADMIN_PASSWORD the admin pages don't exist.
 */
export function requireAdmin(request: Request): Response | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new Response(null, { status: 404 });
  const ip = clientIp(request.headers);
  if (failsByIp.full(ip) || failsAll.full('*')) {
    return new Response(null, { status: 429, headers: { 'Retry-After': '900' } });
  }
  const header = request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const given = decoded.slice(decoded.indexOf(':') + 1);
    if (timingSafeEqual(digest(given), digest(password))) return null;
    failsByIp.take(ip);
    failsAll.take('*');
  }
  return new Response(null, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="shiqi.si admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
