/**
 * Asking Uniqlo for one product's size chart and details (name, price, colours, tags) (the phone can: a web page
 * on another site can't, as Uniqlo sends no CORS header). Only the product code leaves the
 * phone, never the body. The cache is the stored fetched list (STORAGE_KEYS.fetched).
 */

import { isMissingProduct, readyFetchedGarment, uniqloToSeedGarment, uniqloUrls, type UniqloLink } from '@choudo/core/domain/links';
import type { CheckError } from '@choudo/core/ui-logic/checkText';
import { isFresh } from '@choudo/core/ui-logic/state/fetched';
import type { StoredFetched } from '@choudo/core/ui-logic/state/stored';

export const FETCH_TIMEOUT_MS = 10_000;

export type FetchOutcome =
  /** Both responses, as text (the converter parses and checks them). */
  | { kind: 'ok'; sizeChart: string; details: string }
  /** No such product: the details' 404 ("nok", no-such-product), or an "ok" with no result. */
  | { kind: 'not-found' }
  /** No answer: offline, a timeout, or a dropped connection (after one retry). */
  | { kind: 'network' }
  /** Uniqlo answered with an error status (non-2xx). */
  | { kind: 'blocked'; status: number };

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Got = { ok: true; text: string } | { ok: false; status: number; text: string };

/** One GET with a timeout. Throws on a network error or a timeout; a non-2xx is a result. */
async function get(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Got> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: abort.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, status: res.status, text: await res.text().catch(() => '') };
    return { ok: true, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/** `get`, tried once more when the network fails (not when Uniqlo answers with an error). */
async function getWithRetry(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Got> {
  try {
    return await get(url, fetchImpl, timeoutMs);
  } catch {
    return get(url, fetchImpl, timeoutMs);
  }
}

/** Both requests for a product code, in parallel. Never throws. */
export async function fetchUniqlo(productCode: string, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS }: FetchOptions = {}): Promise<FetchOutcome> {
  const urls = uniqloUrls(productCode);
  try {
    const [chart, details] = await Promise.all([
      getWithRetry(urls.sizeChart, fetchImpl, timeoutMs),
      getWithRetry(urls.details, fetchImpl, timeoutMs),
    ]);
    // Uniqlo answers a product it doesn't have with a 404 on the details.
    if (!details.ok && details.status === 404 && isMissingProduct(chart.ok ? chart.text : null, details.text)) return { kind: 'not-found' };
    if (!chart.ok) return { kind: 'blocked', status: chart.status };
    if (!details.ok) return { kind: 'blocked', status: details.status };
    if (isMissingProduct(chart.text, details.text)) return { kind: 'not-found' };
    return { kind: 'ok', sizeChart: chart.text, details: details.text };
  } catch {
    return { kind: 'network' };
  }
}

export type CheckOutcome =
  /** `fromCache`: no request was made (fresh), or Uniqlo couldn't be reached and this is the copy kept. */
  | { kind: 'ok'; entry: StoredFetched; fromCache: boolean }
  | { kind: 'error'; error: CheckError };

export interface CheckOptions extends FetchOptions {
  /** What's stored for this product, if anything. */
  cached?: StoredFetched;
  now?: Date;
}

/**
 * A size chart for the link: the stored copy while it's under 7 days old; otherwise
 * Uniqlo's, turned into a garment. Offline (or blocked), an older stored copy still shows.
 * The caller stores a new entry (addFetched).
 */
export async function checkUniqloLink(link: UniqloLink, { cached, now = new Date(), ...fetchOptions }: CheckOptions = {}): Promise<CheckOutcome> {
  if (cached && isFresh(cached, now)) return { kind: 'ok', entry: cached, fromCache: true };
  const fetched = await fetchUniqlo(link.productCode, fetchOptions);
  if (fetched.kind === 'network' || fetched.kind === 'blocked') {
    return cached ? { kind: 'ok', entry: cached, fromCache: true } : { kind: 'error', error: 'network' };
  }
  if (fetched.kind === 'not-found') return { kind: 'error', error: 'not-found' };
  const result = uniqloToSeedGarment(fetched.sizeChart, fetched.details, link, now.toISOString().slice(0, 10));
  if (!result.ok) return { kind: 'error', error: result.reason };
  // A chart the seed checks reject (a girth that can't be flat, sizes out of order) would be dropped on load.
  if (readyFetchedGarment(result.garment) === null) return { kind: 'error', error: 'unreadable-chart' };
  return { kind: 'ok', entry: { product: result.product, fetchedAt: now.toISOString() }, fromCache: false };
}
