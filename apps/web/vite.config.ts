import mdx from '@mdx-js/rollup';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{ enforce: 'pre', ...mdx({ providerImportSource: undefined }) }, reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
  },
});
