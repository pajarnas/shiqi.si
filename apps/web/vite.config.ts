import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { mdxPlugin } from './mdx.config';

export default defineConfig({
  plugins: [mdxPlugin(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
  },
});
