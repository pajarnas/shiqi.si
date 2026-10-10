// Display names for subfolders inside a note folder (e.g. commonplace/kafka/).
// The names live in i18n/strings under notes.subfolders; a subfolder without
// one shows its directory name.
import type { Strings } from '~/i18n';

export const subfolderTitle = (t: Strings, id: string) =>
  (t.notes.subfolders as Record<string, string>)[id] ?? id;
