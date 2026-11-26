/**
 * Garments read from pasted product links, as kept on the device (STORAGE_KEYS.fetched):
 * one list, newest first, that is both the Fitting room's "From your link" garments and
 * the 7-day cache by product. Pure; the phone stores it. Never written to seed.json.
 */

import type { Garment } from '../../domain/garments';
import { readyFetchedGarment, type FetchedProduct } from '../../domain/links';
import type { StoredFetched } from './stored';

/** Fetched garments kept at most. */
export const MAX_FETCHED = 30;
/** Unsupported hosts kept at most (Test mode only). */
export const MAX_UNSUPPORTED_HOSTS = 50;
/** How long a fetched chart is used without asking the brand again. */
export const FETCH_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
/** Recent checks listed under the link field. */
export const RECENT_CHECKS = 5;

/** A stored fetched garment, checked and ready for the fit engine. */
export interface ReadyFetched {
  garment: Garment;
  product: FetchedProduct;
  fetchedAt: string;
}

/** `entry` first, replacing an older copy of the same garment; at most MAX_FETCHED. */
export function addFetched(list: readonly StoredFetched[], entry: StoredFetched): StoredFetched[] {
  const id = entry.product.garment.id;
  return [entry, ...list.filter((e) => e.product.garment.id !== id)].slice(0, MAX_FETCHED);
}

/** `host` first, once; at most MAX_UNSUPPORTED_HOSTS. */
export function addUnsupportedHost(list: readonly string[], host: string): string[] {
  return [host, ...list.filter((h) => h !== host)].slice(0, MAX_UNSUPPORTED_HOSTS);
}

/** The stored entry for a garment id, or undefined. */
export const findFetched = (list: readonly StoredFetched[], garmentId: string): StoredFetched | undefined =>
  list.find((e) => e.product.garment.id === garmentId);

/** Fetched less than FETCH_CACHE_MS before `now` (and not in the future). */
export function isFresh(entry: Pick<StoredFetched, 'fetchedAt'>, now: Date): boolean {
  const at = Date.parse(entry.fetchedAt);
  const age = now.getTime() - at;
  return Number.isFinite(at) && age >= 0 && age < FETCH_CACHE_MS;
}

/**
 * The stored list, each garment through validateSeed + normalizeGarment like a seed row;
 * one that fails is dropped (a like or outfit pointing at it is then skipped, never deleted).
 */
export function readyFetched(list: readonly StoredFetched[]): ReadyFetched[] {
  const out: ReadyFetched[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    const garment = readyFetchedGarment(e.product.garment);
    if (!garment || seen.has(garment.id)) continue;
    seen.add(garment.id);
    out.push({ garment, product: e.product, fetchedAt: e.fetchedAt });
  }
  return out;
}
