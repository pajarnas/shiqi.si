import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { mdxPlugin } from './apps/web/mdx.config';

export default defineConfig({
  plugins: [mdxPlugin()],
  resolve: {
    alias: { '~': fileURLToPath(new URL('./apps/web/app', import.meta.url)) },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/app/**/*.test.ts'],
  },
});
