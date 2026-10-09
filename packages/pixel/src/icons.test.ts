import { describe, expect, it } from 'vitest';
import { ICONS, PATTERN_ICONS, iconPath } from './icons';

describe('icons', () => {
  it('are at most 16x16', () => {
    for (const ic of Object.values(ICONS)) {
      expect(ic.w, ic.name).toBeLessThanOrEqual(16);
      expect(ic.h, ic.name).toBeLessThanOrEqual(16);
    }
  });

  it('only reference known icons in the pattern set', () => {
    for (const name of PATTERN_ICONS) expect(ICONS[name]).toBeDefined();
  });

  it('produce SVG path data for the ink layer', () => {
    expect(iconPath(ICONS.cursor, 'ink')).toMatch(/^M0 0h1v1h-1z/);
  });
});
