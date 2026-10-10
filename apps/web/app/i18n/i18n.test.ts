import { describe, expect, it } from 'vitest';
import { stringsFor } from './index';
import { localeForCountry, localeFromAcceptLanguage } from './locales';
import { deepMerge, missingStrings, setPath } from './merge';
import { en } from './strings/en';
import { zh } from './strings/zh';

describe('dictionaries', () => {
  it('zh translates every English string', () => {
    // Gaps would be machine-translated at runtime; hand-written is better.
    expect(missingStrings(en, zh).map((m) => m.path.join('.'))).toEqual([]);
  });

  it('keep the same placeholders and tags in every translation', () => {
    const marks = (s: string) => [...s.matchAll(/\{\w+\}|<\/?\w+>/g)].map((m) => m[0]).sort();
    const zhFull = stringsFor('zh');
    for (const { path, text } of missingStrings(en, {})) {
      let v: unknown = zhFull;
      for (const k of path) v = (v as Record<string | number, unknown>)[k];
      expect(marks(String(v)), path.join('.')).toEqual(marks(text));
    }
  });

  it('fill gaps from machine translations without overriding hand-written ones', () => {
    const t = stringsFor('zh', { nav: { home: 'MACHINE' }, critter: { first: ['MACHINE'] } });
    expect(t.nav.home).toBe('首页');
    expect(stringsFor('en', { nav: { home: 'X' } }).nav.home).toBe('X');
  });
});

describe('merge helpers', () => {
  it('merge partial trees, arrays included', () => {
    expect(deepMerge({ a: 'A', b: ['x', 'y'] }, { b: [undefined, 'Y'] })).toEqual({
      a: 'A',
      b: ['x', 'Y'],
    });
  });

  it('list missing strings and put them back by path', () => {
    const base = { a: 'A', list: ['x', 'y'], empty: '' };
    const missing = missingStrings(base, { list: ['X'] });
    expect(missing).toEqual([
      { path: ['a'], text: 'A' },
      { path: ['list', 1], text: 'y' },
    ]);
    const tree = {};
    for (const m of missing) setPath(tree, m.path, m.text.toUpperCase());
    expect(tree).toEqual({ a: 'A', list: [undefined, 'Y'] });
  });
});

describe('locale detection', () => {
  it('maps countries', () => {
    expect(localeForCountry('CN')).toBe('zh');
    expect(localeForCountry('tw')).toBe('zh-Hant');
    expect(localeForCountry('JP')).toBe('ja');
    expect(localeForCountry('MX')).toBe('es');
    expect(localeForCountry('US')).toBe('en');
    expect(localeForCountry(null)).toBe(null);
  });

  it('reads Accept-Language by weight', () => {
    expect(localeFromAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh');
    expect(localeFromAcceptLanguage('zh-TW,zh;q=0.9')).toBe('zh-Hant');
    expect(localeFromAcceptLanguage('pt;q=1, en;q=0.5, zh;q=0.7')).toBe('zh');
    expect(localeFromAcceptLanguage('fr-CA,fr;q=0.9')).toBe('fr');
    expect(localeFromAcceptLanguage('de-DE')).toBe('de');
    expect(localeFromAcceptLanguage('pt-BR')).toBe(null);
    expect(localeFromAcceptLanguage(null)).toBe(null);
  });
});
