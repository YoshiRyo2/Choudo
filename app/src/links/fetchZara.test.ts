import { describe, expect, it, vi, type Mock } from 'vitest';
import { parseProductLink, zaraUrls, type ZaraLink } from '@choudo/core/domain/links';
import guide from '@choudo/core/domain/links/__fixtures__/zara-guide-616513993.json';
import missingGuide from '@choudo/core/domain/links/__fixtures__/zara-guide-missing.json';
import search from '@choudo/core/domain/links/__fixtures__/zara-search-04174639.json';
import noMatch from '@choudo/core/domain/links/__fixtures__/zara-search-no-match.json';
import { FETCH_CACHE_MS } from '@choudo/core/ui-logic/state/fetched';
import type { StoredFetched } from '@choudo/core/ui-logic/state/stored';
import { upstreamUrl } from '../../../worker/src/handle';
import { FETCH_SERVICE, productPhoto } from './fetchUniqlo';
import { checkZaraLink, fetchZara, zaraServiceUrls } from './fetchZara';

const navy = parseProductLink('https://www.zara.com/us/en/-p04174639.html?v1=616513993') as ZaraLink;
const bare = parseProductLink('https://www.zara.com/us/en/-p04174639.html') as ZaraLink;
const SEARCH = zaraServiceUrls.search('04174639');
const GUIDE = zaraServiceUrls.sizeGuide(616513993);
const NOW = new Date('2026-11-28T12:00:00.000Z');

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) } as Response);
type FetchMock = Mock<(url: string, init?: RequestInit) => Promise<Response>> & typeof fetch;
function mockFetch(by: { search?: () => Promise<Response>; guide?: () => Promise<Response> } = {}): FetchMock {
  return vi.fn((url: string) => {
    if (url === SEARCH) return by.search ? by.search() : reply(search);
    if (url.endsWith('/size-guide')) return by.guide ? by.guide() : reply(guide);
    return Promise.reject(new Error(`unexpected ${url}`));
  }) as FetchMock;
}

describe('zaraServiceUrls', () => {
  it('asks for the two Zara routes the service answers, which stand for exactly zaraUrls', () => {
    expect(zaraServiceUrls.search('04174639', FETCH_SERVICE)).toBe(`${FETCH_SERVICE}/zara/04174639/search`);
    expect(zaraServiceUrls.sizeGuide(616513993, FETCH_SERVICE)).toBe(`${FETCH_SERVICE}/zara/616513993/size-guide`);
    expect(upstreamUrl(new URL(zaraServiceUrls.search('04174639', FETCH_SERVICE)).pathname)).toBe(zaraUrls.search('04174639'));
    expect(upstreamUrl(new URL(zaraServiceUrls.sizeGuide(616513993, FETCH_SERVICE)).pathname)).toBe(zaraUrls.sizeGuide(616513993));
  });

  it('refuses anything that is not a Zara number or id', () => {
    expect(() => zaraServiceUrls.search('0417463')).toThrow();
    expect(() => zaraServiceUrls.search('../admin')).toThrow();
    expect(() => zaraServiceUrls.sizeGuide('12345')).toThrow();
  });
});

describe('fetchZara', () => {
  it("asks for the search, then the link's colour's guide, and nothing else", async () => {
    const fetchImpl = mockFetch();
    expect(await fetchZara(navy, { fetchImpl })).toEqual({ kind: 'ok', search: JSON.stringify(search), guide: JSON.stringify(guide) });
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([SEARCH, GUIDE]);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init).not.toHaveProperty('body');
      expect(init?.credentials).toBe('omit');
    }
  });

  it("without ?v1= asks for the first result's colour", async () => {
    const fetchImpl = mockFetch();
    await fetchZara(bare, { fetchImpl });
    expect(fetchImpl.mock.calls[1]![0]).toBe(zaraServiceUrls.sizeGuide(616513995));
  });

  it('not-found when the search has no such product; the guide is never asked for', async () => {
    const fetchImpl = mockFetch({ search: () => reply(noMatch) });
    expect(await fetchZara(navy, { fetchImpl })).toEqual({ kind: 'not-found' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("no-sizes for Zara's guide 404; the service's own 404 is blocked", async () => {
    expect(await fetchZara(navy, { fetchImpl: mockFetch({ guide: () => reply(missingGuide, 404) }) })).toEqual({ kind: 'no-sizes' });
    expect(await fetchZara(navy, { fetchImpl: mockFetch({ guide: () => reply({ status: 'error', reason: 'not-found' }, 404) }) })).toEqual({
      kind: 'blocked',
      status: 404,
    });
  });

  it('blocked for an error status, network after two network errors, unreadable for a search that is not one', async () => {
    expect(await fetchZara(navy, { fetchImpl: mockFetch({ search: () => reply('denied', 403) }) })).toEqual({ kind: 'blocked', status: 403 });
    const down = mockFetch({ guide: () => Promise.reject(new TypeError('Failed to fetch')) });
    expect(await fetchZara(navy, { fetchImpl: down })).toEqual({ kind: 'network' });
    expect(down.mock.calls.filter((c) => c[0] === GUIDE)).toHaveLength(2);
    expect(await fetchZara(navy, { fetchImpl: mockFetch({ search: () => reply('<html>hi</html>') }) })).toEqual({ kind: 'unreadable' });
  });
});

describe('checkZaraLink', () => {
  it('turns the answers into a stored entry, and uses it for 7 days', async () => {
    const r = await checkZaraLink(navy, { fetchImpl: mockFetch(), now: NOW });
    if (r.kind !== 'ok') throw new Error(r.error);
    expect(r.fromCache).toBe(false);
    expect(r.entry.product.garment).toMatchObject({ id: 'zara-04174639', brand: 'Zara', name: 'Interlock Long-Sleeve T-Shirt' });
    const fetchImpl = mockFetch();
    const later = new Date(NOW.getTime() + FETCH_CACHE_MS - 60_000);
    expect(await checkZaraLink(navy, { cached: r.entry, fetchImpl, now: later })).toEqual({ kind: 'ok', entry: r.entry, fromCache: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('names each failure', async () => {
    const at = (by: Parameters<typeof mockFetch>[0]) => checkZaraLink(navy, { fetchImpl: mockFetch(by), now: NOW });
    expect(await at({ search: () => reply(noMatch) })).toEqual({ kind: 'error', error: 'not-found' });
    expect(await at({ guide: () => reply(missingGuide, 404) })).toEqual({ kind: 'error', error: 'no-sizes' });
    expect(await at({ search: () => reply('{"status":"ERROR"}') })).toEqual({ kind: 'error', error: 'bad-response' });
    expect(await at({ search: () => reply('denied', 429) })).toEqual({ kind: 'error', error: 'network' });
  });

  it('offline: shows an old stored copy', async () => {
    const first = await checkZaraLink(navy, { fetchImpl: mockFetch(), now: NOW });
    if (first.kind !== 'ok') throw new Error(first.error);
    const cached: StoredFetched = { ...first.entry, fetchedAt: '2026-10-01T00:00:00.000Z' };
    const offline = mockFetch({ search: () => Promise.reject(new TypeError('offline')) });
    expect(await checkZaraLink(navy, { cached, fetchImpl: offline, now: NOW })).toEqual({ kind: 'ok', entry: cached, fromCache: true });
  });
});

describe('productPhoto', () => {
  it("keeps only https photos on Uniqlo's or Zara's image host", () => {
    expect(productPhoto('https://static.zara.net/assets/public/a/b.jpg?w=750')).toBe('https://static.zara.net/assets/public/a/b.jpg?w=750');
    expect(productPhoto('https://image.uniqlo.com/a.jpg')).toBe('https://image.uniqlo.com/a.jpg');
    expect(productPhoto('http://static.zara.net/a.jpg')).toBeNull();
    expect(productPhoto('https://static.zara.net.example.net/a.jpg')).toBeNull();
    expect(productPhoto('https://www.zara.com/a.jpg')).toBeNull();
    expect(productPhoto(null)).toBeNull();
  });
});
