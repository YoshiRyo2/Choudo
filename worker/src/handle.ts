/**
 * The fetch service's logic (index.ts is the Worker's entry; it may only export the handler).
 *
 * choudo-fetch: lets the Choudo website read Uniqlo US's public size chart and product
 * details, which the browser can't (Uniqlo sends no CORS header).
 *
 * Not a general proxy. One route, GET /uniqlo/<productCode>/<size-chart | details>, and it
 * only ever calls the two addresses core's uniqloUrls() builds; nothing in the request
 * (query string, headers, cookies, IP) is passed on. Logs nothing.
 */

import { UNIQLO_PRODUCT_CODE, uniqloUrls } from '@choudo/core/domain/links/urls';

/** Who may read the answers: the site, and the Vite dev (5173) and preview (4173) servers. */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://yoshiryo2.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
];

export const USER_AGENT = 'Choudo/1.0 (+https://yoshiryo2.github.io/Choudo/)';
export const UPSTREAM_TIMEOUT_MS = 8_000;
/** How long an ok answer is kept in the Workers cache: 24 h. */
export const CACHE_SECONDS = 24 * 60 * 60;

const ROUTE = /^\/uniqlo\/([^/]+)\/(size-chart|details)$/;
const METHODS = 'GET, OPTIONS';

/** What `handle` needs from the runtime, passed in so tests can fake it. */
export interface Deps {
  fetch: typeof fetch;
  /** The Workers cache (caches.default), or null to skip caching. */
  cache: Cache | null;
  /** Keeps a cache write running after the response is sent (ctx.waitUntil). */
  waitUntil?: (promise: Promise<unknown>) => void;
  timeoutMs?: number;
}

/** The Uniqlo address a path stands for, or null for any other path. */
export function upstreamUrl(pathname: string): string | null {
  const m = ROUTE.exec(pathname);
  if (!m || !UNIQLO_PRODUCT_CODE.test(m[1]!)) return null;
  const urls = uniqloUrls(m[1]!.toUpperCase());
  return m[2] === 'size-chart' ? urls.sizeChart : urls.details;
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const cors = corsHeaders(request.headers.get('Origin'));
  const target = upstreamUrl(new URL(request.url).pathname);

  if (request.method !== 'GET' && request.method !== 'OPTIONS') {
    return json({ status: 'error', reason: 'method' }, 405, { ...cors, Allow: METHODS });
  }
  if (!target) return json({ status: 'error', reason: 'not-found' }, 404, cors);
  if (request.method === 'OPTIONS') {
    const preflight: Record<string, string> = cors['Access-Control-Allow-Origin'] ? { 'Access-Control-Allow-Methods': METHODS, 'Access-Control-Max-Age': '86400' } : {};
    return new Response(null, { status: 204, headers: { ...cors, ...preflight, Allow: METHODS } });
  }

  const key = new Request(target, { method: 'GET' });
  const hit = await deps.cache?.match(key).catch(() => undefined);
  if (hit) return withHeaders(await hit.text(), 200, cors, true);

  const answer = await askUniqlo(target, deps);
  if (answer.kind === 'timeout') return json({ status: 'error', reason: 'timeout' }, 504, cors);
  if (answer.kind === 'failed') return json({ status: 'error', reason: 'upstream' }, 502, cors);

  const { status, body } = answer;
  const cacheable = status === 200 && isOk(body);
  if (cacheable && deps.cache) {
    const write = deps.cache.put(key, withHeaders(body, 200, {}, true)).catch(() => undefined);
    if (deps.waitUntil) deps.waitUntil(write);
    else await write;
  }
  return withHeaders(body, status, cors, cacheable);
}

type Answer = { kind: 'ok'; status: number; body: string } | { kind: 'timeout' } | { kind: 'failed' };

/** One request to Uniqlo with only our own headers; redirects are not followed. */
async function askUniqlo(url: string, deps: Deps): Promise<Answer> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS);
  try {
    const res = await deps.fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      redirect: 'manual',
      signal: controller.signal,
    });
    // A redirect would point somewhere else: never followed, never passed on.
    if (res.status >= 300 && res.status < 400) return { kind: 'failed' };
    return { kind: 'ok', status: res.status, body: await res.text() };
  } catch {
    return timedOut ? { kind: 'timeout' } : { kind: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

const isOk = (body: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null && (parsed as { status?: unknown }).status === 'ok';
  } catch {
    return false;
  }
};

function corsHeaders(origin: string | null): Record<string, string> {
  const vary = { Vary: 'Origin' };
  return origin && ALLOWED_ORIGINS.includes(origin) ? { ...vary, 'Access-Control-Allow-Origin': origin } : vary;
}

/** A fresh response: our headers only (Uniqlo's, cookies included, are dropped). */
function withHeaders(body: string, status: number, extra: Record<string, string>, cacheable: boolean): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cacheable ? `public, max-age=${CACHE_SECONDS}` : 'no-store',
      ...extra,
    },
  });
}

const json = (body: unknown, status: number, extra: Record<string, string>) => withHeaders(JSON.stringify(body), status, extra, false);
