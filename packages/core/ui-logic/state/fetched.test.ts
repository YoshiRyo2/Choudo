import { describe, expect, it } from 'vitest';
import { parseProductLink, uniqloToSeedGarment, type UniqloLink } from '../../domain/links';
import sizeChart from '../../domain/links/__fixtures__/uniqlo-size-charts-E424873-000.json';
import product from '../../domain/links/__fixtures__/uniqlo-product-E424873-000.json';
import {
  addFetched,
  addUnsupportedHost,
  FETCH_CACHE_MS,
  findFetched,
  isFresh,
  MAX_FETCHED,
  MAX_UNSUPPORTED_HOSTS,
  readyFetched,
} from './fetched';
import { isFetchedList, isStringList, type StoredFetched } from './stored';

const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/00') as UniqloLink;
const converted = uniqloToSeedGarment(sizeChart, product, link, '2026-11-26');
if (!converted.ok) throw new Error(converted.reason);
const TEE: StoredFetched = { product: converted.product, fetchedAt: '2026-11-26T10:00:00.000Z' };
/** The tee under another id. */
const other = (n: number, fetchedAt = TEE.fetchedAt): StoredFetched => ({
  product: { ...TEE.product, garment: { ...TEE.product.garment, id: `uniqlo-E00000${n}-000` } },
  fetchedAt,
});

describe('addFetched', () => {
  it('puts the newest first and keeps one copy per garment', () => {
    const later = { ...TEE, fetchedAt: '2026-11-27T10:00:00.000Z' };
    expect(addFetched([other(1), TEE], later)).toEqual([later, other(1)]);
  });

  it(`keeps at most ${MAX_FETCHED}`, () => {
    const many = Array.from({ length: MAX_FETCHED }, (_, i) => other(i));
    const next = addFetched(many, TEE);
    expect(next).toHaveLength(MAX_FETCHED);
    expect(next[0]).toBe(TEE);
    expect(findFetched(next, other(MAX_FETCHED - 1).product.garment.id)).toBeUndefined();
  });
});

describe('addUnsupportedHost', () => {
  it(`puts the newest first, once, at most ${MAX_UNSUPPORTED_HOSTS}`, () => {
    expect(addUnsupportedHost(['a.com', 'zara.com'], 'zara.com')).toEqual(['zara.com', 'a.com']);
    const many = Array.from({ length: MAX_UNSUPPORTED_HOSTS }, (_, i) => `h${i}.com`);
    expect(addUnsupportedHost(many, 'new.com')).toHaveLength(MAX_UNSUPPORTED_HOSTS);
  });
});

describe('isFresh', () => {
  const at = new Date(TEE.fetchedAt).getTime();
  it('is fresh for seven days, not after, and not for a time in the future or unreadable', () => {
    expect(isFresh(TEE, new Date(at + FETCH_CACHE_MS - 1))).toBe(true);
    expect(isFresh(TEE, new Date(at + FETCH_CACHE_MS))).toBe(false);
    expect(isFresh(TEE, new Date(at - 1000))).toBe(false);
    expect(isFresh({ fetchedAt: 'yesterday' }, new Date(at))).toBe(false);
  });
});

describe('readyFetched', () => {
  it('normalises each garment and drops any that fail the seed checks', () => {
    const broken = { ...other(2), product: { ...other(2).product, garment: { ...other(2).product.garment, sizes: [] } } };
    const ready = readyFetched([TEE, broken, other(3)]);
    expect(ready.map((r) => r.garment.id)).toEqual(['uniqlo-E424873-000', 'uniqlo-E000003-000']);
    expect(ready[0]!.garment.grade).toBe('charted');
    expect(ready[0]!.product.priceText).toBe('$14.90');
  });
});

describe('stored guards', () => {
  it('reads back a fetched list and a host list, and rejects other shapes', () => {
    expect(isFetchedList(JSON.parse(JSON.stringify([TEE])))).toBe(true);
    expect(isFetchedList([])).toBe(true);
    expect(isFetchedList([{ product: TEE.product }])).toBe(false);
    expect(isFetchedList([{ ...TEE, product: { ...TEE.product, productUrl: 5 } }])).toBe(false);
    expect(isFetchedList({})).toBe(false);
    expect(isStringList(['zara.com'])).toBe(true);
    expect(isStringList([1])).toBe(false);
  });
});
