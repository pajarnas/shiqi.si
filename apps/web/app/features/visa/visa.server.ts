// Wires @shiqi/visa to this app: the shared MySQL pool, the data key, the
// Claude API and the family login. Everything visa-specific lives in the
// package, so moving it to its own API service later means swapping this file
// for HTTP calls.
import {
  anthropicCaller,
  createSealer,
  createSigner,
  migrateVisa,
  parseFamily,
  sameSecret,
  seedFamily,
  VisaStore,
  type CreateMessage,
} from '@shiqi/visa';
import { data, redirect } from 'react-router';
import { requireAdmin } from '~/features/visits/auth.server';
import { clientIp } from '~/features/visits/visits';
import { getDb } from '~/lib/db.server';
import { rateLimiter } from '~/lib/rate-limit.server';

export { runTurn } from '@shiqi/visa';

export interface Visa {
  store: VisaStore;
  /** Null when ANTHROPIC_API_KEY is not set: pages work, the chat says it is off. */
  create: CreateMessage | null;
  model: string | undefined;
}

let ready: Promise<void> | undefined;

/** The visa service, or null when the database or VISA_DATA_KEY is missing. */
export async function getVisa(): Promise<Visa | null> {
  const key = process.env.VISA_DATA_KEY;
  const db = await getDb();
  if (!key || !db) return null;
  const store = new VisaStore(db, createSealer(key));
  ready ??= (async () => {
    await migrateVisa(db);
    if (await seedFamily(store, parseFamily(process.env.VISA_FAMILY))) {
      console.log('[visa] created the family profiles from VISA_FAMILY');
    }
  })().catch((err: unknown) => {
    ready = undefined;
    throw err;
  });
  await ready;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return {
    store,
    create: apiKey ? anthropicCaller(apiKey) : null,
    model: process.env.VISA_MODEL || undefined,
  };
}

/** Chat turns per person: generous for someone typing, a stop for a runaway script. */
export const chatLimit = rateLimiter(30, 10 * 60_000);

/** Headers for every visa page: never cached, never indexed. */
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

// The family pages (/visa and /chat/visa): one shared password
// (VISA_FAMILY_PASSWORD), then a signed cookie for 30 days. Profiles are
// shared, so there is no per-person login.
export const FAMILY_HOME = '/visa';
const COOKIE = 'visa_family';
const MAX_AGE = 30 * 24 * 60 * 60;
const loginLimit = rateLimiter(10, 15 * 60_000);

function signer() {
  const key = process.env.VISA_DATA_KEY;
  return key ? createSigner(key) : null;
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Whether the family password is set at all; without it the family page stays closed. */
export function familyLoginEnabled() {
  return Boolean(process.env.VISA_FAMILY_PASSWORD && signer());
}

export function isFamily(request: Request): boolean {
  const cookie = readCookie(request, COOKIE);
  const value = cookie && signer()?.verify(cookie);
  const expires = value?.startsWith('family.') ? Number(value.slice('family.'.length)) : 0;
  return familyLoginEnabled() && expires > Date.now();
}

/** Sends anyone without the family cookie to the login page. */
export function requireFamily(request: Request) {
  if (!isFamily(request)) throw redirect(FAMILY_HOME);
}

export type LoginResult = { ok: true; cookie: string } | { ok: false; reason: 'wrong' | 'busy' };

export function login(request: Request, password: string): LoginResult {
  const expected = process.env.VISA_FAMILY_PASSWORD;
  const s = signer();
  if (!loginLimit.take(clientIp(request.headers))) return { ok: false, reason: 'busy' };
  if (!expected || !s || !sameSecret(password, expected)) return { ok: false, reason: 'wrong' };
  const value = s.sign(`family.${Date.now() + MAX_AGE * 1000}`);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return {
    ok: true,
    cookie: `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`,
  };
}

export const logoutCookie = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

/** For family pages: the service and one person with their family's shared answers. */
export async function loadPerson(request: Request, id: string) {
  requireFamily(request);
  const visa = await getVisa();
  if (!visa) throw data(null, { status: 503 });
  const a = await visa.store.getApplicant(Number(id));
  if (!a) throw data(null, { status: 404 });
  const c = await visa.store.getCase(a.caseId);
  return { visa, a, caseAnswers: c?.answers ?? {} };
}
