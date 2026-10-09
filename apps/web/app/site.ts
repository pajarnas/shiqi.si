// Site map in one place: menus, home page lists and the sitemap all read from here.
// Words people read live in i18n/strings; this file holds the structure and the
// fixed pixel-font labels (eyebrows, window file names) that stay the same in
// every language.
import type { IconName } from '@shiqi/pixel';
import type { Strings } from '~/i18n';

export const SITE = {
  name: 'shiqi.si',
  url: 'https://shiqi.si',
  copyright: '© 2026 shiqi.si',
} as const;

export type EntryKey = keyof Strings['entries'];

export interface Entry {
  path: string;
  /** Key into strings.entries for the title and description. */
  key: EntryKey;
  /** Pixel-font label, the same in every language. */
  label: string;
  icon: IconName;
}

export const NAV = [
  { path: '/', key: 'home' },
  { path: '/play', key: 'play' },
  { path: '/tools', key: 'tools' },
  { path: '/notes', key: 'notes' },
  { path: '/ui', key: 'ui' },
] as const satisfies readonly { path: string; key: keyof Strings['nav'] }[];

export const TOYS: readonly Entry[] = [
  { path: '/play/wallpaper', key: 'wallpaper', label: 'WALLPAPER', icon: 'picture' },
  { path: '/play/doodle', key: 'doodle', label: 'DOODLE', icon: 'face' },
  { path: '/play/pad', key: 'pad', label: 'PIXEL PAD', icon: 'pencil' },
];

export const TOOLS: readonly Entry[] = [
  { path: '/tools/time', key: 'time', label: 'TIME', icon: 'clock' },
  { path: '/tools/color', key: 'color', label: 'COLOR', icon: 'palette' },
  { path: '/tools/encode', key: 'encode', label: 'ENCODE', icon: 'swap' },
  { path: '/tools/uuid', key: 'uuid', label: 'UUID', icon: 'dice' },
  { path: '/tools/json', key: 'json', label: 'JSON', icon: 'braces' },
];

/** Window title (shown like a file name) and eyebrow of each page. */
export const PAGES = {
  play: { file: 'play/', eyebrow: 'PLAY' },
  wallpaper: { file: 'play/wallpaper', eyebrow: 'WALLPAPER' },
  doodle: { file: 'play/doodle', eyebrow: 'DOODLE' },
  pad: { file: 'play/pad', eyebrow: 'PIXEL PAD' },
  tools: { file: 'tools/', eyebrow: 'TOOLS' },
  time: { file: 'tools/time', eyebrow: 'TIME' },
  color: { file: 'tools/color', eyebrow: 'COLOR' },
  encode: { file: 'tools/encode', eyebrow: 'ENCODE' },
  uuid: { file: 'tools/uuid', eyebrow: 'UUID' },
  json: { file: 'tools/json', eyebrow: 'JSON' },
  notes: { file: 'notes/', eyebrow: 'NOTES' },
  ui: { file: 'ui/', eyebrow: '@shiqi/ui' },
} as const;
