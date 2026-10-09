import { describe, expect, it } from 'vitest';
import { resolveLocale } from './locale.server';
import { sanitize } from './notes.server';

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe('resolveLocale', () => {
  it('prefers the URL, then the cookie, then the country, then the browser', async () => {
    const h = {
      cookie: 'lang=zh',
      'cf-ipcountry': 'US',
      'accept-language': 'zh-CN',
    };
    expect(await resolveLocale(req('https://shiqi.si/?lang=en', h))).toEqual({
      locale: 'en',
      source: 'query',
    });
    expect((await resolveLocale(req('https://shiqi.si/', h))).source).toBe('cookie');
    expect(
      await resolveLocale(req('https://shiqi.si/', { ...h, cookie: '', 'cf-ipcountry': 'CN' })),
    ).toEqual({ locale: 'zh', source: 'ip' });
    expect(
      await resolveLocale(
        req('https://shiqi.si/', { 'accept-language': 'zh-TW', 'x-forwarded-for': '10.0.0.2' }),
      ),
    ).toEqual({ locale: 'zh', source: 'header' });
    expect(await resolveLocale(req('https://shiqi.si/'))).toEqual({
      locale: 'en',
      source: 'default',
    });
  });
});

describe('sanitize', () => {
  it('removes scripts, handlers and javascript: links', () => {
    expect(
      sanitize(
        '<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">a</a>',
      ),
    ).toBe('<p>hi</p><a href="#">a</a>');
  });
});
