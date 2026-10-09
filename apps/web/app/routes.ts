import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  layout('routes/site.tsx', [
    index('routes/home.tsx'),
    ...prefix('play', [
      index('routes/play/index.tsx'),
      route('wallpaper', 'routes/play/wallpaper.tsx'),
      route('doodle', 'routes/play/doodle.tsx'),
      route('pad', 'routes/play/pad.tsx'),
    ]),
    ...prefix('tools', [
      index('routes/tools/index.tsx'),
      route('time', 'routes/tools/time.tsx'),
      route('color', 'routes/tools/color.tsx'),
      route('encode', 'routes/tools/encode.tsx'),
      route('uuid', 'routes/tools/uuid.tsx'),
      route('json', 'routes/tools/json.tsx'),
    ]),
    ...prefix('notes', [
      index('routes/notes/index.tsx'),
      route(':folder', 'routes/notes/folder.tsx'),
      route(':folder/:slug', 'routes/notes/note.tsx'),
    ]),
    route('ui', 'routes/ui.tsx'),
    route('admin/visits', 'routes/admin/visits.tsx'),
    route('*', 'routes/not-found.tsx'),
  ]),
  ...prefix('api', [
    route('health', 'routes/api/health.ts'),
    route('locale', 'routes/api/locale.ts'),
  ]),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('robots.txt', 'routes/robots.ts'),
] satisfies RouteConfig;
