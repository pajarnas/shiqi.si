// Notes are MDX files in folder subdirectories (see folders.ts). Each one
// exports `frontmatter`. Adding a note = adding a file; lists, topic pages and
// the sitemap pick it up.
import type { ComponentType } from 'react';
import { FOLDERS, type FolderId } from './folders';

export { FOLDERS, findFolder, type Folder, type FolderId } from './folders';

export interface NoteMeta {
  title: string;
  /** ISO 8601 date, YYYY-MM-DD. */
  date: string;
  summary: string;
  /** Lowercase, hyphenated topic tags, e.g. `docker`, `ssh`. */
  topics: readonly string[];
  /** A note that is one part of a series, e.g. a chapter of a course. */
  series?: { id: string; part: number };
}

export interface Note extends NoteMeta {
  folder: FolderId;
  /** A directory inside the folder, e.g. `kafka` in commonplace/kafka/; null at the top. */
  subfolder: string | null;
  /** The file name without .mdx. */
  name: string;
  /** Path inside the folder: `<subfolder>/<name>` or `<name>`. */
  slug: string;
  /** `/notes/<folder>/<slug>` */
  href: string;
  Component: ComponentType;
}

const modules = import.meta.glob<{ default: ComponentType; frontmatter: NoteMeta }>(
  ['./*/*.mdx', './*/*/*.mdx'],
  { eager: true },
);

const folderIds = new Set<string>(FOLDERS.map((f) => f.id));

export const NOTES: readonly Note[] = Object.entries(modules)
  .map(([path, mod]) => {
    const [, folder = '', subfolder, name = ''] =
      /^\.\/([^/]+)\/(?:([^/]+)\/)?([^/]+)\.mdx$/.exec(path) ?? [];
    if (!folderIds.has(folder)) throw new Error(`${path}: "${folder}" is not listed in folders.ts`);
    const slug = subfolder ? `${subfolder}/${name}` : name;
    return {
      ...mod.frontmatter,
      folder: folder as FolderId,
      subfolder: subfolder ?? null,
      name,
      slug,
      href: `/notes/${folder}/${slug}`,
      Component: mod.default,
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

export const latestNotes = (n: number) => NOTES.slice(0, n);
export const notesIn = (folder: string) => NOTES.filter((n) => n.folder === folder);
export const notesTagged = (topic: string) => NOTES.filter((n) => n.topics.includes(topic));
export const findNote = (folder: string | undefined, slug: string | undefined) =>
  NOTES.find((n) => n.folder === folder && n.slug === slug);
/** For old `/notes/<slug>` links from before folders existed. */
export const findNoteBySlug = (slug: string | undefined) => NOTES.find((n) => n.name === slug);
/** For old `/notes/<folder>/<name>` links to notes since moved into a subfolder. */
export const findMovedNote = (folder: string | undefined, name: string | undefined) =>
  NOTES.find((n) => n.folder === folder && n.name === name);
/** The subfolders of a folder, sorted. */
export const subfoldersIn = (folder: string) =>
  [...new Set(notesIn(folder).flatMap((n) => (n.subfolder ? [n.subfolder] : [])))].sort();

/** Every topic with its note count, most used first. */
export const TOPICS: readonly { topic: string; count: number }[] = [
  ...NOTES.flatMap((n) => n.topics).reduce(
    (m, t) => m.set(t, (m.get(t) ?? 0) + 1),
    new Map<string, number>(),
  ),
]
  .map(([topic, count]) => ({ topic, count }))
  .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

/** Every note in a series, in order. */
export const seriesNotes = (id: string) =>
  NOTES.filter((n) => n.series?.id === id).sort(
    (a, b) => (a.series?.part ?? 0) - (b.series?.part ?? 0),
  );
