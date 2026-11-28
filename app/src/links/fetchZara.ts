/**
 * Asking for one Zara product's search result and size guide from the website. A web page
 * can't ask Zara itself (no CORS header), so both go to Choudo's fetch service (worker/),
 * which asks Zara for exactly the addresses core's zaraUrls builds. One after the other: the
 * search gives the colour's product id the guide is asked for. Only the link's number and
 * that id are sent, never the body. The phone's twin is mobile/src/links/fetch-zara.ts.
 */

import {
  isMissingZara,
  isMissingZaraGuide,
  readyFetchedGarment,
  ZARA_PRODUCT_ID,
  ZARA_SEO_ID,
  zaraSizeGuideId,
  zaraToSeedGarment,
  type ZaraLink,
} from '@choudo/core/domain/links';
import { isFresh } from '@choudo/core/ui-logic/state/fetched';
import { FETCH_BASE, FETCH_TIMEOUT_MS, type CheckOptions, type CheckOutcome, type FetchOptions } from './fetchUniqlo';
import { getWithRetry } from './request';

/** The fetch service's two Zara routes (worker/src/handle.ts). */
export const zaraServiceUrls = {
  search(seoId: string, base: string = FETCH_BASE): string {
    if (!ZARA_SEO_ID.test(seoId)) throw new Error(`Not a Zara product number: ${seoId}`);
    return `${base}/zara/${seoId}/search`;
  },
  sizeGuide(productId: number | string, base: string = FETCH_BASE): string {
    const id = String(productId);
    if (!ZARA_PRODUCT_ID.test(id)) throw new Error(`Not a Zara product id: ${id}`);
    return `${base}/zara/${id}/size-guide`;
  },
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
  /** An error status from Zara, passed on by the service, or the service's own (502, 504). */
  | { kind: 'blocked'; status: number };

/** The search, then the chosen colour's size guide. Never throws. */
export async function fetchZara(
  link: ZaraLink,
  { fetchImpl = (...args) => fetch(...args), timeoutMs = FETCH_TIMEOUT_MS, base = FETCH_BASE }: FetchOptions = {},
): Promise<ZaraFetchOutcome> {
  try {
    const search = await getWithRetry(zaraServiceUrls.search(link.seoId, base), fetchImpl, timeoutMs);
    if (!search.ok) return { kind: 'blocked', status: search.status };
    if (isMissingZara(search.text, link.seoId)) return { kind: 'not-found' };
    const productId = zaraSizeGuideId(search.text, link);
    if (productId === null) return { kind: 'unreadable' };
    const guide = await getWithRetry(zaraServiceUrls.sizeGuide(productId, base), fetchImpl, timeoutMs);
    // Not every product has a guide: Zara answers 404 "has not related size and measure guides".
    if (!guide.ok && guide.status === 404 && isMissingZaraGuide(guide.text)) return { kind: 'no-sizes' };
    if (!guide.ok) return { kind: 'blocked', status: guide.status };
    return { kind: 'ok', search: search.text, guide: guide.text };
  } catch {
    return { kind: 'network' };
  }
}

/**
 * A size chart for the link: the stored copy while it's under 7 days old; otherwise
 * Zara's (through the service), turned into a garment. Offline (or blocked), an older
 * stored copy still shows. The caller stores a new entry (addFetched).
 */
export async function checkZaraLink(link: ZaraLink, { cached, now = new Date(), ...fetchOptions }: CheckOptions = {}): Promise<CheckOutcome> {
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
