// The visitor's IP as seen through Caddy, which sets X-Forwarded-For.
// Only the first hop is the client; anything after it was added by proxies.

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;
  return request.headers.get('x-real-ip')?.trim() || null;
}

/** Loopback and private ranges, where a geo lookup can't say anything. */
export function isPrivateIp(ip: string): boolean {
  return (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === '::1' ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip) ||
    ip.startsWith('::ffff:127.')
  );
}
