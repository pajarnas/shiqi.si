import { afterAll, describe, expect, it } from 'vitest';
import { requireAdmin } from './auth.server';

const basic = (pw: string, ip: string) =>
  new Request('http://x/admin', {
    headers: {
      authorization: `Basic ${Buffer.from(`a:${pw}`).toString('base64')}`,
      'x-forwarded-for': ip,
    },
  });

describe('requireAdmin', () => {
  const before = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'right-one';
  afterAll(() => {
    process.env.ADMIN_PASSWORD = before;
  });

  it('locks an address out after ten wrong passwords, even for the right one', () => {
    expect(requireAdmin(basic('right-one', '10.0.0.1'))).toBeNull();
    for (let i = 0; i < 10; i++) expect(requireAdmin(basic('guess', '10.0.0.1'))?.status).toBe(401);
    expect(requireAdmin(basic('right-one', '10.0.0.1'))?.status).toBe(429);
    expect(requireAdmin(basic('right-one', '10.0.0.2'))).toBeNull();
  });

  it('does not count right passwords', () => {
    for (let i = 0; i < 20; i++) expect(requireAdmin(basic('right-one', '10.0.0.3'))).toBeNull();
  });
});
