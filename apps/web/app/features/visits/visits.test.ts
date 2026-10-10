import { describe, expect, it } from 'vitest';
import {
  clientIp,
  filterQuery,
  flag,
  makeVisit,
  pageWindow,
  pagePath,
  parseFilters,
  parseVisit,
  shortAgent,
  shortReferrer,
} from './visits';
import { COUNTRY_SHAPES, shade } from './worldmap';

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

  it('flags crawlers and round-trips through JSON', () => {
    const v = makeVisit(headers('Googlebot/2.1', '1.1.1.1'), '/', null, 5);
    expect(v.bot).toBe(true);
    expect(parseVisit(JSON.stringify(v))).toEqual(v);
    expect(parseVisit('{')).toBeNull();
  });
});

describe('admin filters', () => {
  it('parses and rebuilds a query', () => {
    const f = parseFilters(new URLSearchParams('ip=1.2.3.4&country=cn&page=3&bots=1'));
    expect(f).toEqual({ ip: '1.2.3.4', country: 'CN', path: '', bots: true, page: 3 });
    expect(filterQuery(f)).toBe('?ip=1.2.3.4&country=CN&bots=1&page=3');
    expect(filterQuery({ page: 1 })).toBe('?');
  });

  it('rejects junk', () => {
    const f = parseFilters(new URLSearchParams('country=china&page=-2'));
    expect(f.country).toBe('');
    expect(f.page).toBe(1);
    expect(parseFilters(new URLSearchParams('country=--')).country).toBe('--');
  });

  it('shows pages around the current one', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });
});

describe('display helpers', () => {
  it('names browsers and systems', () => {
    const mac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
    expect(shortAgent(mac)).toBe('Chrome · macOS');
    expect(shortAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')).toBe(
      'Safari · iOS',
    );
    expect(shortAgent('Googlebot/2.1')).toBe('Googlebot');
  });

  it('makes flags', () => {
    expect(flag('CN')).toBe('🇨🇳');
    expect(flag(null)).toBe('🌐');
  });
});

describe('world map', () => {
  it('has shapes for big and tiny places', () => {
    for (const code of ['US', 'CN', 'BR', 'HK', 'SG'])
      expect(COUNTRY_SHAPES.get(code)).toMatch(/^M/);
  });

  it('shades on a log scale', () => {
    expect(shade(0, 10)).toBe(0);
    expect(shade(1, 1)).toBe(4);
    expect(shade(1, 100)).toBe(1);
    expect(shade(100, 100)).toBe(4);
  });
});
