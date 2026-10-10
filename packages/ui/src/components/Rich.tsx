import { Fragment, type ReactNode } from 'react';

/**
 * Render a dictionary string that marks up parts with tags, e.g.
 * 'Try <link>Pixel Wallpaper</link>' with tags={{ link: (s) => <Link to="…">{s}</Link> }}.
 * Keeps translations whole sentences while the markup stays in code.
 */
export function Rich({
  text,
  tags,
}: {
  text: string;
  tags: Record<string, (children: string) => ReactNode>;
}) {
  const parts: ReactNode[] = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const [whole, name = '', inner = ''] = m;
    if (m.index > last) parts.push(text.slice(last, m.index));
    const render = tags[name];
    parts.push(<Fragment key={m.index}>{render ? render(inner) : inner}</Fragment>);
    last = m.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
