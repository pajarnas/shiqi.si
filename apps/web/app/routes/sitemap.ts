import { FOLDERS, NOTES } from '~/content/notes';
import { SITE, TOOLS, TOYS } from '~/site';

export function loader() {
  const paths = [
    '/',
    '/tools',
    '/notes',
    '/ui',
    ...TOYS.map((t) => t.path),
    ...TOOLS.map((t) => t.path),
    ...FOLDERS.map((f) => `/notes/${f.id}`),
    ...NOTES.map((n) => n.href),
  ];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${SITE.url}${p}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
