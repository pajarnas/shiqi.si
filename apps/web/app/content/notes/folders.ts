import type { IconName } from '@shiqi/pixel';

// The note folders. A folder is a subdirectory of content/notes with the
// same id; order here is the order on /notes.
export const FOLDERS = [
  {
    id: 'journal',
    title: 'Journal',
    subtitle: '学习流水',
    description: 'A dated log of what I built and learned each day, mistakes included.',
    icon: 'note',
  },
  {
    id: 'commonplace',
    title: 'Commonplace',
    subtitle: '杂学',
    description: 'Evergreen notes on one topic each: Docker, SSH, DNS, Kubernetes and the rest.',
    icon: 'book',
  },
  {
    id: 'essays',
    title: 'Essays',
    subtitle: '随想',
    description: 'Thoughts on pixels, standards and this site.',
    icon: 'pencil',
  },
] as const satisfies readonly {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: IconName;
}[];

export type Folder = (typeof FOLDERS)[number];
export type FolderId = Folder['id'];

export const findFolder = (id: string | undefined) => FOLDERS.find((f) => f.id === id);
