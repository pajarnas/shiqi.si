import type { IconName } from '@shiqi/pixel';

// The note folders. A folder is a subdirectory of content/notes with the
// same id; order here is the order on /notes. Names and descriptions are in
// i18n/strings (notes.folders.<id>); `label` is the pixel-font eyebrow.
export const FOLDERS = [
  { id: 'journal', label: 'JOURNAL', icon: 'note' },
  { id: 'commonplace', label: 'COMMONPLACE', icon: 'book' },
  { id: 'essays', label: 'ESSAYS', icon: 'pencil' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

export type Folder = (typeof FOLDERS)[number];
export type FolderId = Folder['id'];

export const findFolder = (id: string | undefined) => FOLDERS.find((f) => f.id === id);
