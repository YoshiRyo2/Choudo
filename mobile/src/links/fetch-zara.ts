/**
 * Asking Zara for one product: the search (by the link's number) that gives its colours, then
 * the size guide for the chosen colour's product id. The phone asks Zara directly; if Zara
 * turns a request away (403 or 429: bot protection), that one request is tried once more
 * through Choudo's fetch service (worker/), which asks Zara for the same address. Only the
 * link's number and the colour's id leave the phone, never the body.
 */

import {
  isMissingZara,
  isMissingZaraGuide,
  readyFetchedGarment,
  zaraSizeGuideId,
  zaraToSeedGarment,
  zaraUrls,
  type ZaraLink,
} from '@choudo/core/domain/links';
import { isFresh } from '@choudo/core/ui-logic/state/fetched';

import { FETCH_TIMEOUT_MS, type CheckOptions, type CheckOutcome, type FetchOptions } from './fetch-uniqlo';
import { getWithRetry, type Got } from './request';

/** Choudo's fetch service: the website's FETCH_SERVICE (app/src/links/service.ts). */
export const FETCH_SERVICE = 'https://choudo-fetch.ryodyoshida.workers.dev';

/** Statuses that mean Zara turned the phone away, so the fetch service is tried. */
const TURNED_AWAY = new Set([403, 429]);

/** The fetch service's routes for the same two Zara addresses (worker/src/handle.ts). */
export const zaraServiceUrls = {
  search: (seoId: string, base: string = FETCH_SERVICE): string => `${base}/zara/${seoId}/search`,
  sizeGuide: (productId: number, base: string = FETCH_SERVICE): string => `${base}/zara/${productId}/size-guide`,
};

export type ZaraFetchOutcome =
  /** Both answers, as text (the converter parses and checks them). */
  | { kind: 'ok'; search: string; guide: string }
  /** The search has no product with the link's number. */
  | { kind: 'not-found' }
  /** Zara has no size guide for the product (its 404). */
  | { kind: 'no-sizes' }
  /** The search answered, but not in a shape Choudo reads. */
  | { kind: 'unreadable' }
  /** No answer: offline, a timeout, or a dropped connection (after one retry). */
  | { kind: 'network' }
  /** Zara answered with an error status (non-2xx), through the service too when it was tried. */
  | { kind: 'blocked'; status: number };

export interface ZaraFetchOptions extends FetchOptions {
  /** The fetch service's address (tests). */
  service?: string;
}

/** Zara directly; when it turns the request away, once through the fetch service. */
async function ask(direct: string, viaService: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Got> {
  const got = await getWithRetry(direct, fetchImpl, timeoutMs);
  if (got.ok || !TURNED_AWAY.has(got.status)) return got;
  try {
    return await getWithRetry(viaService, fetchImpl, timeoutMs);
  } catch {
    return got;
  }
}

/** The search, then the chosen colour's size guide. Never throws. */
export async function fetchZara(
  link: ZaraLink,
  { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS, service = FETCH_SERVICE }: ZaraFetchOptions = {},
): Promise<ZaraFetchOutcome> {
  try {
    const search = await ask(zaraUrls.search(link.seoId), zaraServiceUrls.search(link.seoId, service), fetchImpl, timeoutMs);
    if (!search.ok) return { kind: 'blocked', status: search.status };
    if (isMissingZara(search.text, link.seoId)) return { kind: 'not-found' };
    const productId = zaraSizeGuideId(search.text, link);
    if (productId === null) return { kind: 'unreadable' };
    const guide = await ask(zaraUrls.sizeGuide(productId), zaraServiceUrls.sizeGuide(productId, service), fetchImpl, timeoutMs);
    // Not every product has a guide: Zara answers 404 "has not related size and measure guides".
    if (!guide.ok && guide.status === 404 && isMissingZaraGuide(guide.text)) return { kind: 'no-sizes' };
    if (!guide.ok) return { kind: 'blocked', status: guide.status };
    return { kind: 'ok', search: search.text, guide: guide.text };
  } catch {
    return { kind: 'network' };
  }
}

/**
 * A size chart for the link: the stored copy while it's under 7 days old; otherwise Zara's,
 * turned into a garment. Offline (or blocked), an older stored copy still shows. The caller
 * stores a new entry (addFetched).
 */
export async function checkZaraLink(
  link: ZaraLink,
  { cached, now = new Date(), ...fetchOptions }: CheckOptions & ZaraFetchOptions = {},
): Promise<CheckOutcome> {
  if (cached && isFresh(cached, now)) return { kind: 'ok', entry: cached, fromCache: true };
  const fetched = await fetchZara(link, fetchOptions);
  if (fetched.kind === 'network' || fetched.kind === 'blocked') {
    return cached ? { kind: 'ok', entry: cached, fromCache: true } : { kind: 'error', error: 'network' };
  }
  if (fetched.kind === 'not-found') return { kind: 'error', error: 'not-found' };
  if (fetched.kind === 'no-sizes') return { kind: 'error', error: 'no-sizes' };
  if (fetched.kind === 'unreadable') return { kind: 'error', error: 'bad-response' };
  const result = zaraToSeedGarment(fetched.search, fetched.guide, link, now.toISOString().slice(0, 10));
  if (!result.ok) return { kind: 'error', error: result.reason };
  if (readyFetchedGarment(result.garment) === null) return { kind: 'error', error: 'unreadable-chart' };
  return { kind: 'ok', entry: { product: result.product, fetchedAt: now.toISOString() }, fromCache: false };
}
