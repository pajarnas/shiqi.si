import { PageHeader, Window } from '@shiqi/ui';
import type { ReactNode } from 'react';

/** Every inner page is one window on the desktop with a standard header. */
export function PageWindow({
  file,
  eyebrow,
  title,
  lede,
  children,
}: {
  /** Shown in the title bar, like a file name. */
  file: string;
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Window title={file}>
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />
      {children}
    </Window>
  );
}

export const pageMeta = (title: string, description: string) => [
  { title: `${title} · shiqi.si` },
  { name: 'description', content: description },
];
