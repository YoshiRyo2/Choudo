import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { parseProductLink, uniqloUrls, type UniqloLink } from '@choudo/core/domain/links';
import sizeChart from '@choudo/core/domain/links/__fixtures__/uniqlo-size-charts-E424873-000.json';
import product from '@choudo/core/domain/links/__fixtures__/uniqlo-details-E424873-000.json';
import missing from '@choudo/core/domain/links/__fixtures__/uniqlo-details-missing.json';
import { FETCH_CACHE_MS } from '@choudo/core/ui-logic/state/fetched';
import type { StoredFetched } from '@choudo/core/ui-logic/state/stored';
import { upstreamUrl } from '../../../worker/src/handle';
import { checkUniqloLink, FETCH_BASE, FETCH_SERVICE, fetchUniqlo, serviceUrls, uniqloPhoto } from './fetchUniqlo';

const CODE = 'E424873-000';
const urls = serviceUrls(CODE);
const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/00') as UniqloLink;
const NOW = new Date('2026-11-26T12:00:00.000Z');

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) } as Response);

type FetchMock = Mock<(url: string, init?: RequestInit) => Promise<Response>> & typeof fetch;

/** A fetch that answers each service address with the fixture (or what `by` says). */
function mockFetch(by: Partial<Record<'chart' | 'product', () => Promise<Response>>> = {}): FetchMock {
  return vi.fn((url: string) => {
    if (url === urls.sizeChart) return by.chart ? by.chart() : reply(sizeChart);
    if (url === urls.details) return by.product ? by.product() : reply(product);
    return Promise.reject(new Error(`unexpected ${url}`));
  }) as FetchMock;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('serviceUrls', () => {
  it('points at the fetch service unless VITE_FETCH_BASE says otherwise', () => {
    expect(FETCH_BASE).toBe(import.meta.env.VITE_FETCH_BASE ? import.meta.env.VITE_FETCH_BASE.replace(/\/+$/, '') : FETCH_SERVICE);
    expect(serviceUrls(CODE, FETCH_SERVICE)).toEqual({
      sizeChart: `${FETCH_SERVICE}/uniqlo/E424873-000/size-chart`,
      details: `${FETCH_SERVICE}/uniqlo/E424873-000/details`,
    });
  });

  it('asks for the two routes the service answers, which stand for exactly uniqloUrls()', () => {
    const service = serviceUrls(CODE, FETCH_SERVICE);
    expect(upstreamUrl(new URL(service.sizeChart).pathname)).toBe(uniqloUrls(CODE).sizeChart);
    expect(upstreamUrl(new URL(service.details).pathname)).toBe(uniqloUrls(CODE).details);
  });

  it('refuses anything that is not a product code', () => {
    expect(() => serviceUrls('../admin')).toThrow();
    expect(() => serviceUrls('E424873-000/../x')).toThrow();
  });
});

describe('fetchUniqlo', () => {
  it('asks the service for both and returns their text, sending nothing but the code', async () => {
    const fetchImpl = mockFetch();
    const r = await fetchUniqlo(CODE, { fetchImpl });
    expect(r).toEqual({ kind: 'ok', sizeChart: JSON.stringify(sizeChart), details: JSON.stringify(product) });
    expect(fetchImpl.mock.calls.map((c) => c[0]).sort()).toEqual([urls.details, urls.sizeChart].sort());
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init).not.toHaveProperty('body');
      expect(init?.credentials).toBe('omit');
    }
  });

  it('asks in parallel, not one after the other', async () => {
    let started = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const held = (body: unknown) => () => {
      started += 1;
      return gate.then(() => reply(body));
    };
    const pending = fetchUniqlo(CODE, { fetchImpl: mockFetch({ chart: held(sizeChart), product: held(product) }) });
    await Promise.resolve();
    expect(started).toBe(2);
    release();
    expect((await pending).kind).toBe('ok');
  });

  it('tries once more after a network error', async () => {
    let tries = 0;
    const fetchImpl = mockFetch({ chart: () => (++tries === 1 ? Promise.reject(new TypeError('Failed to fetch')) : reply(sizeChart)) });
    expect((await fetchUniqlo(CODE, { fetchImpl })).kind).toBe('ok');
    expect(tries).toBe(2);
  });

  it('says network after two network errors', async () => {
    const fetchImpl = mockFetch({ product: () => Promise.reject(new TypeError('Failed to fetch')) });
    expect(await fetchUniqlo(CODE, { fetchImpl })).toEqual({ kind: 'network' });
    expect(fetchImpl.mock.calls.filter((c) => c[0] === urls.details)).toHaveLength(2);
  });

  it('gives up on a request after 10 s (and its retry)', async () => {
    vi.useFakeTimers();
    const hang = (init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => (url === urls.sizeChart ? hang(init) : reply(product))) as FetchMock;
    const pending = fetchUniqlo(CODE, { fetchImpl });
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'network' });
    expect(fetchImpl.mock.calls.filter((c) => c[0] === urls.sizeChart)).toHaveLength(2);
  });

  it("says blocked for an error status, without retrying (Uniqlo's, or the service's 502 / 504)", async () => {
    const fetchImpl = mockFetch({ chart: () => reply('denied', 403) });
    expect(await fetchUniqlo(CODE, { fetchImpl })).toEqual({ kind: 'blocked', status: 403 });
    expect(fetchImpl.mock.calls.filter((c) => c[0] === urls.sizeChart)).toHaveLength(1);
    const timeout = mockFetch({ product: () => reply({ status: 'error', reason: 'timeout' }, 504) });
    expect(await fetchUniqlo(CODE, { fetchImpl: timeout })).toEqual({ kind: 'blocked', status: 504 });
  });

  it("says not-found for the details' 404 passed on by the service", async () => {
    expect(await fetchUniqlo(CODE, { fetchImpl: mockFetch({ product: () => reply(missing, 404) }) })).toEqual({ kind: 'not-found' });
    // Any other 404 (the service's own, say) is still blocked.
    const other = mockFetch({ product: () => reply({ status: 'error', reason: 'not-found' }, 404) });
    expect(await fetchUniqlo(CODE, { fetchImpl: other })).toEqual({ kind: 'blocked', status: 404 });
  });

  it('says not-found when Uniqlo answers ok with no product', async () => {
    expect(await fetchUniqlo(CODE, { fetchImpl: mockFetch({ chart: () => reply({ status: 'ok', result: [] }) }) })).toEqual({ kind: 'not-found' });
  });
});

describe('checkUniqloLink', () => {
  const fresh = async () => {
    const r = await checkUniqloLink(link, { fetchImpl: mockFetch(), now: NOW });
    if (r.kind !== 'ok') throw new Error(r.error);
    return r.entry;
  };

  it('turns the answers into a stored entry', async () => {
    const r = await checkUniqloLink(link, { fetchImpl: mockFetch(), now: NOW });
    expect(r).toMatchObject({ kind: 'ok', fromCache: false, entry: { fetchedAt: NOW.toISOString() } });
    if (r.kind !== 'ok') return;
    expect(r.entry.product.garment).toMatchObject({ id: 'uniqlo-E424873-000', name: 'Crew Neck T-Shirt', source: { capturedOn: '2026-11-26' } });
    expect(r.entry.product.priceText).toBe('$14.90');
  });

  it('uses a stored copy under 7 days old without asking', async () => {
    const cached = await fresh();
    const fetchImpl = mockFetch();
    const later = new Date(NOW.getTime() + FETCH_CACHE_MS - 60_000);
    expect(await checkUniqloLink(link, { cached, fetchImpl, now: later })).toEqual({ kind: 'ok', entry: cached, fromCache: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('asks again once the stored copy is 7 days old', async () => {
    const cached = await fresh();
    const later = new Date(NOW.getTime() + FETCH_CACHE_MS);
    expect(await checkUniqloLink(link, { cached, fetchImpl: mockFetch(), now: later })).toMatchObject({ kind: 'ok', fromCache: false, entry: { fetchedAt: later.toISOString() } });
  });

  it('offline: shows an old stored copy, or says network without one', async () => {
    const cached: StoredFetched = { ...(await fresh()), fetchedAt: '2026-10-01T00:00:00.000Z' };
    const offline = mockFetch({ chart: () => Promise.reject(new TypeError('offline')), product: () => Promise.reject(new TypeError('offline')) });
    expect(await checkUniqloLink(link, { cached, fetchImpl: offline, now: NOW })).toEqual({ kind: 'ok', entry: cached, fromCache: true });
    expect(await checkUniqloLink(link, { fetchImpl: offline, now: NOW })).toEqual({ kind: 'error', error: 'network' });
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ product: () => reply('', 503) }), now: NOW })).toEqual({ kind: 'error', error: 'network' });
  });

  it('passes on what the converter says', async () => {
    const pants = { ...sizeChart, result: [{ ...sizeChart.result[0]!, sizeChart: sizeChart.result[0]!.sizeChart.map((s) => ({ ...s, sizeParts: [] })) }] };
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ chart: () => reply(pants) }), now: NOW })).toEqual({ kind: 'error', error: 'unsupported-parts' });
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ chart: () => reply('{oops') }), now: NOW })).toEqual({ kind: 'error', error: 'bad-response' });
  });

  it('says unreadable-chart for a chart the seed checks reject', async () => {
    const doubled = JSON.parse(JSON.stringify(sizeChart).replace(/"value":"(43|46|49)"/g, (_m, v) => `"value":"${Number(v) * 2}"`));
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ chart: () => reply(doubled) }), now: NOW })).toEqual({ kind: 'error', error: 'unreadable-chart' });
  });
});

describe('uniqloPhoto', () => {
  it("keeps only https photos on Uniqlo's image host", () => {
    const photo = 'https://image.uniqlo.com/UQ/ST3/us/imagesgoods/424873/item/usgoods_09_424873_3x4.jpg';
    expect(uniqloPhoto(photo)).toBe(photo);
    expect(uniqloPhoto('http://image.uniqlo.com/a.jpg')).toBeNull();
    expect(uniqloPhoto('https://image.uniqlo.com.example.net/a.jpg')).toBeNull();
    expect(uniqloPhoto('https://tracker.example/a.jpg')).toBeNull();
    expect(uniqloPhoto('not a url')).toBeNull();
    expect(uniqloPhoto(null)).toBeNull();
  });
});
