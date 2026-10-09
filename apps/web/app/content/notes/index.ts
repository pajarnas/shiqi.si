// Notes are MDX files in this folder. Each one exports `frontmatter`.
// Adding a note = adding a file; lists and the sitemap pick it up.
import type { ComponentType } from 'react';

export interface NoteMeta {
  title: string;
  /** ISO 8601 date, YYYY-MM-DD. */
  date: string;
  summary: string;
}

export interface Note extends NoteMeta {
  slug: string;
  Component: ComponentType;
}

const modules = import.meta.glob<{ default: ComponentType; frontmatter: NoteMeta }>('./*.mdx', {
  eager: true,
});

export const NOTES: readonly Note[] = Object.entries(modules)
  .map(([path, mod]) => ({
    slug: path.replace(/^\.\//, '').replace(/\.mdx$/, ''),
    ...mod.frontmatter,
    Component: mod.default,
  }))
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

export const latestNotes = (n: number) => NOTES.slice(0, n);
export const findNote = (slug: string | undefined) => NOTES.find((n) => n.slug === slug);
