import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * HTTP Basic auth against ADMIN_PASSWORD (any user name). Returns null when the
 * request may pass, otherwise the response to send instead. Without
 * ADMIN_PASSWORD the admin pages don't exist.
 */
export function requireAdmin(request: Request): Response | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new Response('Not Found', { status: 404 });
  const header = request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const given = decoded.slice(decoded.indexOf(':') + 1);
    if (timingSafeEqual(digest(given), digest(password))) return null;
  }
  return new Response('需要密码', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="shiqi.si admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
