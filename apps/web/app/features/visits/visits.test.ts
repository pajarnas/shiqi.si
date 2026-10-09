import { describe, expect, it } from 'vitest';
import { clientIp, makeVisit, pagePath, parseVisit, shortReferrer, summarize } from './visits';

describe('pagePath', () => {
  it('maps data requests back to the page', () => {
    expect(pagePath('/_root.data')).toBe('/');
    expect(pagePath('/notes/one-pixel.data')).toBe('/notes/one-pixel');
    expect(pagePath('/notes/')).toBe('/notes');
    expect(pagePath('/')).toBe('/');
  });

  it('skips non-pages', () => {
    for (const p of [
      '/api/health',
      '/api/visit',
      '/admin',
      '/admin/x',
      '/assets/a.js',
      '/robots.txt',
    ]) {
      expect(pagePath(p)).toBeNull();
    }
    expect(pagePath('/apiary')).toBe('/apiary');
    expect(pagePath('/' + 'x'.repeat(300))).toBeNull();
  });
});

describe('clientIp', () => {
  it('takes the address the proxy appended last', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers({ 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('shortReferrer', () => {
  it('drops the query string', () => {
    expect(shortReferrer('https://example.com/a?token=x')).toBe('https://example.com/a');
    expect(shortReferrer('not a url')).toBe('');
    expect(shortReferrer(null)).toBe('');
  });
});

describe('visits', () => {
  const headers = (ua: string, ip: string) =>
    new Headers({ 'user-agent': ua, 'x-forwarded-for': ip });
  const firefox =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0';

  it('flags crawlers and round-trips through JSON', () => {
    const v = makeVisit(headers('Googlebot/2.1', '1.1.1.1'), '/', null, 5);
    expect(v.bot).toBe(true);
    expect(parseVisit(JSON.stringify(v))).toEqual(v);
    expect(parseVisit('{')).toBeNull();
  });

  it('summarizes people per page and leaves bot-only pages out', () => {
    const log = [
      makeVisit(headers(firefox, '1.1.1.1'), '/notes/a', null, 3),
      makeVisit(headers(firefox, '1.1.1.1'), '/notes/a', null, 2),
      makeVisit(headers(firefox, '2.2.2.2'), '/notes/a', null, 1),
      makeVisit(headers('Googlebot/2.1', '9.9.9.9'), '/notes/b', null, 4),
    ];
    const pages = summarize(log, { '/notes/a': '10' });
    expect(pages).toHaveLength(1);
    const [a] = pages;
    expect(a).toMatchObject({ path: '/notes/a', total: 10, views: 3, last: 3 });
    expect(a?.readers).toEqual(['1.1.1.1', '2.2.2.2']);
  });
});
