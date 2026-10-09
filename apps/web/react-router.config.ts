import type { Config } from '@react-router/dev/config';

export default {
  // Server-rendered on Node: pages arrive as HTML, and the same server
  // will host API routes (app/routes/api/*) as the sandbox grows.
  ssr: true,
} satisfies Config;
