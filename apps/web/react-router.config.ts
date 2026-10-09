import type { Config } from '@react-router/dev/config';
import { SITE } from './app/site';

const host = new URL(SITE.url).host;

export default {
  // Server-rendered on Node: pages arrive as HTML, and the same server
  // will host API routes (app/routes/api/*) as the sandbox grows.
  ssr: true,
  // Caddy terminates HTTPS, so the server sees http:// URLs while browsers send
  // `Origin: https://shiqi.si`. React Router rejects form posts whose origin
  // doesn't match unless the site's own hosts are listed here.
  allowedActionOrigins: [host, `www.${host}`],
} satisfies Config;
