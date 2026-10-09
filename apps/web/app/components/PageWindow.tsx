import { PageHeader, Window } from '@shiqi/ui';
import type { ReactNode } from 'react';
import { format, type Strings } from '~/i18n';
import { metaStrings } from '~/i18n/root-data';
import { PAGES } from '~/site';

/** Every inner page is one window on the desktop with a standard header. */
export function PageWindow({
  page,
  file = page && PAGES[page].file,
  eyebrow = page && PAGES[page].eyebrow,
  title,
  lede,
  children,
}: {
  /** Which page: sets the title bar (like a file name) and the eyebrow. */
  page?: keyof typeof PAGES;
  /** Title bar text, for pages not listed in PAGES. */
  file?: string;
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Window title={file ?? ''}>
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />
      {children}
    </Window>
  );
}

/** Title and description tags for a page, in the visitor's language. */
export function pageMeta(
  matches: readonly unknown[],
  pick: (t: Strings) => { title: string; description: string },
) {
  const t = metaStrings(matches);
  const { title, description } = pick(t);
  return [
    { title: format(t.site.pageTitle, { title }) },
    { name: 'description', content: description },
  ];
}
