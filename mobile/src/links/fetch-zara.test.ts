import { parseProductLink, zaraUrls, type ZaraLink } from '@choudo/core/domain/links';
import guide from '@choudo/core/domain/links/__fixtures__/zara-guide-616513993.json';
import missingGuide from '@choudo/core/domain/links/__fixtures__/zara-guide-missing.json';
import search from '@choudo/core/domain/links/__fixtures__/zara-search-04174639.json';
import noMatch from '@choudo/core/domain/links/__fixtures__/zara-search-no-match.json';
import { FETCH_CACHE_MS } from '@choudo/core/ui-logic/state/fetched';

import { checkZaraLink, fetchZara, zaraServiceUrls } from './fetch-zara';

const navy = parseProductLink('https://www.zara.com/us/en/-p04174639.html?v1=616513993') as ZaraLink;
const SEARCH = zaraUrls.search('04174639');
const GUIDE = zaraUrls.sizeGuide(616513993);
const NOW = new Date('2026-11-28T12:00:00.000Z');

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) } as Response);

/** Zara (and the fetch service) answering as `by` says; the fixtures otherwise. */
function mockFetch(by: Record<string, () => Promise<Response>> = {}) {
  return jest.fn((url: string) => {
    if (by[url]) return by[url]!();
    if (url === SEARCH) return reply(search);
    if (url === GUIDE) return reply(guide);
    return Promise.reject(new Error(`unexpected ${url}`));
  }) as unknown as jest.Mock & typeof fetch;
}

describe('fetchZara', () => {
  test("asks Zara for the search, then the link's colour's guide, and nothing else", async () => {
    const fetchImpl = mockFetch();
    expect(await fetchZara(navy, { fetchImpl })).toEqual({ kind: 'ok', search: JSON.stringify(search), guide: JSON.stringify(guide) });
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([SEARCH, GUIDE]);
    for (const [, init] of fetchImpl.mock.calls) expect(init).not.toHaveProperty('body');
  });

  test('not-found without asking for a guide; no-sizes for the guide 404', async () => {
    const none = mockFetch({ [SEARCH]: () => reply(noMatch) });
    expect(await fetchZara(navy, { fetchImpl: none })).toEqual({ kind: 'not-found' });
    expect(none).toHaveBeenCalledTimes(1);
    expect(await fetchZara(navy, { fetchImpl: mockFetch({ [GUIDE]: () => reply(missingGuide, 404) }) })).toEqual({ kind: 'no-sizes' });
  });

  test('a 403 or 429 tries the same request once through the fetch service', async () => {
    for (const status of [403, 429]) {
      const fetchImpl = mockFetch({
        [SEARCH]: () => reply('denied', status),
        [zaraServiceUrls.search('04174639', 'https://svc.test')]: () => reply(search),
      });
      expect((await fetchZara(navy, { fetchImpl, service: 'https://svc.test' })).kind).toBe('ok');
      expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([SEARCH, 'https://svc.test/zara/04174639/search', GUIDE]);
    }
  });

  test('any other error status is blocked at once; the service failing too stays blocked', async () => {
    const busy = mockFetch({ [SEARCH]: () => reply('busy', 503) });
    expect(await fetchZara(navy, { fetchImpl: busy, service: 'https://svc.test' })).toEqual({ kind: 'blocked', status: 503 });
    expect(busy).toHaveBeenCalledTimes(1);
    const both = mockFetch({
      [GUIDE]: () => reply('denied', 403),
      'https://svc.test/zara/616513993/size-guide': () => Promise.reject(new TypeError('offline')),
    });
    expect(await fetchZara(navy, { fetchImpl: both, service: 'https://svc.test' })).toEqual({ kind: 'blocked', status: 403 });
  });

  test('network after two network errors', async () => {
    const fetchImpl = mockFetch({ [SEARCH]: () => Promise.reject(new TypeError('offline')) });
    expect(await fetchZara(navy, { fetchImpl })).toEqual({ kind: 'network' });
    expect(fetchImpl.mock.calls.filter((c) => c[0] === SEARCH)).toHaveLength(2);
  });
});

describe('checkZaraLink', () => {
  test('a stored entry, used for 7 days; offline, an older copy still shows', async () => {
    const r = await checkZaraLink(navy, { fetchImpl: mockFetch(), now: NOW });
    if (r.kind !== 'ok') throw new Error(r.error);
    expect(r.entry.product.garment).toMatchObject({ id: 'zara-04174639', brand: 'Zara' });
    const unused = mockFetch();
    const later = new Date(NOW.getTime() + FETCH_CACHE_MS - 60_000);
    expect(await checkZaraLink(navy, { cached: r.entry, fetchImpl: unused, now: later })).toEqual({ kind: 'ok', entry: r.entry, fromCache: true });
    expect(unused).not.toHaveBeenCalled();
    const stale = { ...r.entry, fetchedAt: '2026-10-01T00:00:00.000Z' };
    const offline = mockFetch({ [SEARCH]: () => Promise.reject(new TypeError('offline')) });
    expect(await checkZaraLink(navy, { cached: stale, fetchImpl: offline, now: NOW })).toEqual({ kind: 'ok', entry: stale, fromCache: true });
  });

  test('names each failure', async () => {
    const at = (by: Record<string, () => Promise<Response>>) => checkZaraLink(navy, { fetchImpl: mockFetch(by), now: NOW });
    expect(await at({ [SEARCH]: () => reply(noMatch) })).toEqual({ kind: 'error', error: 'not-found' });
    expect(await at({ [GUIDE]: () => reply(missingGuide, 404) })).toEqual({ kind: 'error', error: 'no-sizes' });
    expect(await at({ [SEARCH]: () => reply('{"status":"ERROR"}') })).toEqual({ kind: 'error', error: 'bad-response' });
  });
});
