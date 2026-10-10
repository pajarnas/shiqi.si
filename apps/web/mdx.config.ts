// MDX settings shared by the site build and the tests, so the tests render
// notes exactly as the site does.
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';

/** GitHub-flavoured Markdown: tables, strikethrough, task lists, autolinks. */
export const mdxPlugin = () => ({
  enforce: 'pre' as const,
  ...mdx({ providerImportSource: undefined, remarkPlugins: [remarkGfm] }),
});
