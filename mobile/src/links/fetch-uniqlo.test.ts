import { parseProductLink, uniqloUrls, type UniqloLink } from '@choudo/core/domain/links';
import sizeChart from '@choudo/core/domain/links/__fixtures__/uniqlo-size-charts-E424873-000.json';
import product from '@choudo/core/domain/links/__fixtures__/uniqlo-details-E424873-000.json';
import missing from '@choudo/core/domain/links/__fixtures__/uniqlo-details-missing.json';
import { FETCH_CACHE_MS } from '@choudo/core/ui-logic/state/fetched';
import type { StoredFetched } from '@choudo/core/ui-logic/state/stored';

import { checkUniqloLink, fetchUniqlo } from './fetch-uniqlo';

const CODE = 'E424873-000';
const urls = uniqloUrls(CODE);
const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/00') as UniqloLink;
const NOW = new Date('2026-11-26T12:00:00.000Z');

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) } as Response);

/** A fetch that answers each Uniqlo address with the fixture (or what `by` says). */
function mockFetch(by: Partial<Record<'chart' | 'product', () => Promise<Response>>> = {}) {
  return jest.fn((url: string) => {
    if (url === urls.sizeChart) return by.chart ? by.chart() : reply(sizeChart);
    if (url === urls.details) return by.product ? by.product() : reply(product);
    return Promise.reject(new Error(`unexpected ${url}`));
  }) as unknown as jest.Mock & typeof fetch;
}

describe('fetchUniqlo', () => {
  test('asks for both addresses and returns their text', async () => {
    const fetchImpl = mockFetch();
    const r = await fetchUniqlo(CODE, { fetchImpl });
    expect(r).toEqual({ kind: 'ok', sizeChart: JSON.stringify(sizeChart), details: JSON.stringify(product) });
    expect(fetchImpl.mock.calls.map((c) => c[0]).sort()).toEqual([urls.details, urls.sizeChart].sort());
    // Only the product code goes out: no body, no cookies.
    for (const [, init] of fetchImpl.mock.calls) expect(init).not.toHaveProperty('body');
  });

  test('asks in parallel, not one after the other', async () => {
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

  test('tries once more after a network error', async () => {
    let tries = 0;
    const fetchImpl = mockFetch({ chart: () => (++tries === 1 ? Promise.reject(new TypeError('Network request failed')) : reply(sizeChart)) });
    expect((await fetchUniqlo(CODE, { fetchImpl })).kind).toBe('ok');
    expect(tries).toBe(2);
  });

  test('says network after two network errors', async () => {
    const fetchImpl = mockFetch({ product: () => Promise.reject(new TypeError('Network request failed')) });
    expect(await fetchUniqlo(CODE, { fetchImpl })).toEqual({ kind: 'network' });
    expect(fetchImpl.mock.calls.filter((c) => c[0] === urls.details)).toHaveLength(2);
  });

  test('gives up on a request after the timeout (and its retry)', async () => {
    jest.useFakeTimers();
    try {
      const hang = (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
      const fetchImpl = jest.fn((url: string, init?: RequestInit) => (url === urls.sizeChart ? hang(url, init) : reply(product)));
      const pending = fetchUniqlo(CODE, { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10_000 });
      await jest.advanceTimersByTimeAsync(10_000);
      await jest.advanceTimersByTimeAsync(10_000);
      expect(await pending).toEqual({ kind: 'network' });
      expect(fetchImpl.mock.calls.filter((c) => c[0] === urls.sizeChart)).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('says blocked for an error status, without retrying', async () => {
    const fetchImpl = mockFetch({ chart: () => reply('denied', 403) });
    expect(await fetchUniqlo(CODE, { fetchImpl })).toEqual({ kind: 'blocked', status: 403 });
    expect(fetchImpl.mock.calls.filter((c) => c[0] === urls.sizeChart)).toHaveLength(1);
  });

  test("says not-found for the details' 404 (Uniqlo has no such product)", async () => {
    const fetchImpl = mockFetch({ product: () => reply(missing, 404) });
    expect(await fetchUniqlo(CODE, { fetchImpl })).toEqual({ kind: 'not-found' });
    // Any other error status is still blocked.
    expect(await fetchUniqlo(CODE, { fetchImpl: mockFetch({ product: () => reply('nope', 404) }) })).toEqual({ kind: 'blocked', status: 404 });
  });

  test('says not-found when Uniqlo answers ok with no product', async () => {
    const fetchImpl = mockFetch({ chart: () => reply({ status: 'ok', result: [] }) });
    expect(await fetchUniqlo(CODE, { fetchImpl })).toEqual({ kind: 'not-found' });
  });
});

describe('checkUniqloLink', () => {
  const fresh = async () => {
    const r = await checkUniqloLink(link, { fetchImpl: mockFetch(), now: NOW });
    if (r.kind !== 'ok') throw new Error(r.error);
    return r.entry;
  };

  test('turns the answers into a stored entry', async () => {
    const r = await checkUniqloLink(link, { fetchImpl: mockFetch(), now: NOW });
    expect(r).toMatchObject({ kind: 'ok', fromCache: false, entry: { fetchedAt: NOW.toISOString() } });
    if (r.kind !== 'ok') return;
    expect(r.entry.product.garment).toMatchObject({ id: 'uniqlo-E424873-000', name: 'Crew Neck T-Shirt', source: { capturedOn: '2026-11-26' } });
    expect(r.entry.product.priceText).toBe('$14.90');
  });

  test('uses a stored copy under 7 days old without asking Uniqlo', async () => {
    const cached = await fresh();
    const fetchImpl = mockFetch();
    const later = new Date(NOW.getTime() + FETCH_CACHE_MS - 60_000);
    expect(await checkUniqloLink(link, { cached, fetchImpl, now: later })).toEqual({ kind: 'ok', entry: cached, fromCache: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('asks again once the stored copy is 7 days old', async () => {
    const cached = await fresh();
    const later = new Date(NOW.getTime() + FETCH_CACHE_MS);
    const r = await checkUniqloLink(link, { cached, fetchImpl: mockFetch(), now: later });
    expect(r).toMatchObject({ kind: 'ok', fromCache: false, entry: { fetchedAt: later.toISOString() } });
  });

  test('offline: shows an old stored copy, or says network without one', async () => {
    const cached: StoredFetched = { ...(await fresh()), fetchedAt: '2026-10-01T00:00:00.000Z' };
    const offline = mockFetch({ chart: () => Promise.reject(new TypeError('offline')), product: () => Promise.reject(new TypeError('offline')) });
    expect(await checkUniqloLink(link, { cached, fetchImpl: offline, now: NOW })).toEqual({ kind: 'ok', entry: cached, fromCache: true });
    expect(await checkUniqloLink(link, { fetchImpl: offline, now: NOW })).toEqual({ kind: 'error', error: 'network' });
    // Blocked reads the same to the user.
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ product: () => reply('', 503) }), now: NOW })).toEqual({ kind: 'error', error: 'network' });
  });

  test('passes on what the converter says', async () => {
    const pants = { ...sizeChart, result: [{ ...sizeChart.result[0]!, sizeChart: sizeChart.result[0]!.sizeChart.map((s) => ({ ...s, sizeParts: [] })) }] };
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ chart: () => reply(pants) }), now: NOW })).toEqual({ kind: 'error', error: 'unsupported-parts' });
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ chart: () => reply('{oops') }), now: NOW })).toEqual({ kind: 'error', error: 'bad-response' });
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ chart: () => reply({ status: 'ok', result: [] }) }), now: NOW })).toEqual({ kind: 'error', error: 'not-found' });
  });

  test('says unreadable-chart for a chart the seed checks reject', async () => {
    // Every chest printed as a full circumference while the chart says flat: looks doubled.
    const doubled = JSON.parse(JSON.stringify(sizeChart).replace(/"value":"(43|46|49)"/g, (_m, v) => `"value":"${Number(v) * 2}"`));
    expect(await checkUniqloLink(link, { fetchImpl: mockFetch({ chart: () => reply(doubled) }), now: NOW })).toEqual({ kind: 'error', error: 'unreadable-chart' });
  });
});
