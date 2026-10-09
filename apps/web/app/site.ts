// Site map in one place: menus, home page lists and the sitemap all read from here.
import type { IconName } from '@shiqi/pixel';

export const SITE = {
  name: 'shiqi.si',
  url: 'https://shiqi.si',
  description: 'Shiqi 的像素小站：小玩具、顺手的工具和一些笔记。',
} as const;

export interface Entry {
  path: string;
  title: string;
  en: string;
  description: string;
  icon: IconName;
}

export const NAV = [
  { path: '/', label: '首页' },
  { path: '/play', label: '玩具' },
  { path: '/tools', label: '工具' },
  { path: '/notes', label: '笔记' },
  { path: '/ui', label: '组件库' },
] as const;

export const TOYS: readonly Entry[] = [
  {
    path: '/play/wallpaper',
    title: '像素壁纸',
    en: 'WALLPAPER',
    description: '1984 图标风或像素风景，按你的屏幕尺寸生成，直接下载。',
    icon: 'picture',
  },
  {
    path: '/play/doodle',
    title: '涂鸦墙',
    en: 'DOODLE',
    description: '把一面墙分成格子，每格画点什么，一格都不留空。',
    icon: 'face',
  },
  {
    path: '/play/pad',
    title: '像素画板',
    en: 'PIXEL PAD',
    description: '32×32 的小画布，有镜像、填充和撤销，导出 PNG 或 SVG。',
    icon: 'pencil',
  },
];

export const TOOLS: readonly Entry[] = [
  {
    path: '/tools/time',
    title: '时间戳',
    en: 'TIME',
    description: 'Unix 时间 ↔ ISO 8601，顺便看 ISO 周数。',
    icon: 'clock',
  },
  {
    path: '/tools/color',
    title: '颜色',
    en: 'COLOR',
    description: 'HEX、RGB、HSL、OKLCH 互转，WCAG 对比度检查。',
    icon: 'palette',
  },
  {
    path: '/tools/encode',
    title: '编码与哈希',
    en: 'ENCODE',
    description: 'Base64、URL、Hex 编解码，SHA 摘要。',
    icon: 'swap',
  },
  {
    path: '/tools/uuid',
    title: 'UUID',
    en: 'UUID',
    description: '生成 v4 / v7，解析任意 UUID 的版本和时间。',
    icon: 'dice',
  },
  {
    path: '/tools/json',
    title: 'JSON',
    en: 'JSON',
    description: '格式化、压缩、排序键，报错带行列号。',
    icon: 'braces',
  },
];
