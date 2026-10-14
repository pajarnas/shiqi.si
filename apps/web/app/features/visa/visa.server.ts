// Wires @shiqi/visa to this app: the shared MySQL pool, the data key and the
// Claude API. Everything visa-specific lives in the package, so moving it to its
// own API service later means swapping this file for HTTP calls.
import {
  anthropicCaller,
  createSealer,
  migrateVisa,
  VisaStore,
  type CreateMessage,
} from '@shiqi/visa';
import { data } from 'react-router';
import { requireAdmin } from '~/features/visits/auth.server';
import { getDb } from '~/lib/db.server';
import { rateLimiter } from '~/lib/rate-limit.server';
import { SITE } from '~/site';

export { runTurn } from '@shiqi/visa';

export interface Visa {
  store: VisaStore;
  /** Null when ANTHROPIC_API_KEY is not set: pages work, the chat says it is off. */
  create: CreateMessage | null;
  model: string | undefined;
}

let migrated: Promise<void> | undefined;

/** The visa service, or null when the database or VISA_DATA_KEY is missing. */
export async function getVisa(): Promise<Visa | null> {
  const key = process.env.VISA_DATA_KEY;
  const db = await getDb();
  if (!key || !db) return null;
  migrated ??= migrateVisa(db).catch((err: unknown) => {
    migrated = undefined;
    throw err;
  });
  await migrated;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return {
    store: new VisaStore(db, createSealer(key)),
    create: apiKey ? anthropicCaller(apiKey) : null,
    model: process.env.VISA_MODEL || undefined,
  };
}

/** Chat turns per link: generous for a person typing, a stop for a runaway script. */
export const chatLimit = rateLimiter(30, 10 * 60_000);

/** Headers for every visa page: never cached, never indexed, no token leaking via Referer. */
export const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};

/** Throws the admin auth response (401, or 404 without ADMIN_PASSWORD) so the error page keeps its headers. */
export function adminOnly(request: Request) {
  const denied = requireAdmin(request);
  if (denied) throw data(null, { status: denied.status, headers: denied.headers });
}

/** A family member's private link: on the live site, or wherever this dev server runs. */
export function chatUrl(request: Request, token: string) {
  const base = process.env.NODE_ENV === 'production' ? SITE.url : new URL(request.url).origin;
  return `${base}/visa/c/${token}`;
}
