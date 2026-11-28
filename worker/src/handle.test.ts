import { afterEach, describe, expect, it, vi } from 'vitest';
import { uniqloUrls, zaraUrls } from '@choudo/core/domain/links';
import zaraGuide from '@choudo/core/domain/links/__fixtures__/zara-guide-616513993.json';
import zaraMissingGuide from '@choudo/core/domain/links/__fixtures__/zara-guide-missing.json';
import zaraSearch from '@choudo/core/domain/links/__fixtures__/zara-search-04174639.json';
import { ALLOWED_ORIGINS, CACHE_SECONDS, handle, upstreamUrl, USER_AGENT, type Deps } from './handle';

const CODE = 'E424873-000';
const BASE = 'https://choudo-fetch.example.workers.dev';
const SITE = 'https://yoshiryo2.github.io';
const OK = JSON.stringify({ status: 'ok', result: { name: 'Crew Neck T-Shirt' } });
const MISSING = JSON.stringify({ status: 'nok', error: { code: 25 } });

const get = (path: string, init: RequestInit & { origin?: string } = {}) => {
  const { origin, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (origin) headers.set('Origin', origin);
  return new Request(`${BASE}${path}`, { ...rest, headers });
};

/** A fetch that answers with `body` and `status`, and records what it was asked. */
const upstream = (body = OK, status = 200) =>
  vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(body, { status, headers: { 'Set-Cookie': 'session=1' } })));

/** The Workers cache, in memory: keyed by URL, as the Cache API is for GET requests. */
function fakeCache() {
  const store = new Map<string, Response>();
  return {
    store,
    match: vi.fn(async (req: Request) => store.get(req.url)?.clone()),
    put: vi.fn(async (req: Request, res: Response) => void store.set(req.url, res.clone())),
  };
}

function deps(fetchImpl = upstream(), cache: ReturnType<typeof fakeCache> | null = fakeCache()) {
  const pending: Promise<unknown>[] = [];
  const d: Deps = { fetch: fetchImpl as unknown as typeof fetch, cache: cache as unknown as Cache | null, waitUntil: (p) => void pending.push(p) };
  return { d, fetchImpl, cache, settle: () => Promise.all(pending) };
}

afterEach(() => vi.useRealTimers());

describe('routes', () => {
  it('maps the two paths to exactly the core URLs, and nothing else', () => {
    const urls = uniqloUrls(CODE);
    expect(upstreamUrl(`/uniqlo/${CODE}/size-chart`)).toBe(urls.sizeChart);
    expect(upstreamUrl(`/uniqlo/${CODE}/details`)).toBe(urls.details);
    // Codes are read in any case and asked for in upper case, as the phone does.
    expect(upstreamUrl('/uniqlo/e424873-000/details')).toBe(urls.details);
    for (const path of [
      '/',
      '/uniqlo',
      `/uniqlo/${CODE}`,
      `/uniqlo/${CODE}/size-chart/`,
      `/uniqlo/${CODE}/photos`,
      `/uniqlo/${CODE}/details/extra`,
      '/uniqlo/E42487-000/details',
      '/uniqlo/E4248730-000/details',
      '/uniqlo/4424873-000/details',
      '/uniqlo/E424873-00/details',
      '/uniqlo/E424873%2D000/details',
      '/uniqlo/..%2F..%2Fevil/details',
      `/zara/${CODE}/details`,
      `//uniqlo/${CODE}/details`,
    ]) {
      expect(upstreamUrl(path), path).toBeNull();
    }
  });

  it('fetches the core URL for an allowed route', async () => {
    const { d, fetchImpl } = deps();
    const res = await handle(get(`/uniqlo/${CODE}/size-chart`), d);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(OK);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe(uniqloUrls(CODE).sizeChart);
  });

  it('never takes an address from the request: the query string is ignored', async () => {
    const { d, fetchImpl } = deps();
    await handle(get(`/uniqlo/${CODE}/details?url=https://evil.example/&productIdsWithColorCode=X`), d);
    expect(fetchImpl.mock.calls[0]![0]).toBe(uniqloUrls(CODE).details);
  });

  it('answers 404 for any other path, without calling Uniqlo', async () => {
    const { d, fetchImpl } = deps();
    for (const path of ['/', '/favicon.ico', `/uniqlo/${CODE}/photos`, '/uniqlo/nope/details', `/uniqlo/${CODE}`]) {
      const res = await handle(get(path), d);
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ status: 'error', reason: 'not-found' });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers 405 for methods other than GET and OPTIONS', async () => {
    const { d, fetchImpl } = deps();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
      const res = await handle(get(`/uniqlo/${CODE}/details`, { method, ...(method === 'HEAD' ? {} : { body: '{}' }) }), d);
      expect(res.status, method).toBe(405);
      expect(res.headers.get('Allow')).toBe('GET, OPTIONS');
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('Zara routes', () => {
  const SEO = '04174639';
  const COLOUR = '616513993';
  const SEARCH = JSON.stringify(zaraSearch);
  const GUIDE = JSON.stringify(zaraGuide);
  const NO_GUIDE = JSON.stringify(zaraMissingGuide);

  it('maps the search and size-guide paths to exactly the core URLs', () => {
    expect(upstreamUrl(`/zara/${SEO}/search`)).toBe(zaraUrls.search(SEO));
    expect(upstreamUrl(`/zara/${SEO}/search`)).toBe('https://www.zara.com/itxrest/1/search/store/11719/query?query=04174639&locale=en_US');
    expect(upstreamUrl(`/zara/${COLOUR}/size-guide`)).toBe(zaraUrls.sizeGuide(COLOUR));
    expect(upstreamUrl('/zara/123456/size-guide')).toBe(zaraUrls.sizeGuide('123456'));
    expect(upstreamUrl('/zara/123456789012/size-guide')).toBe(zaraUrls.sizeGuide('123456789012'));
  });

  it('refuses any other id or path', () => {
    for (const path of [
      '/zara',
      `/zara/${SEO}`,
      '/zara/0417463/search',
      '/zara/041746399/search',
      '/zara/0417463a/search',
      `/zara/${SEO}/search/`,
      `/zara/${SEO}/size-guide/extra`,
      `/zara/${SEO}/details`,
      '/zara/12345/size-guide',
      '/zara/1234567890123/size-guide',
      '/zara/61651399x/size-guide',
      '/zara/616513993%2F../size-guide',
      `/zara/${COLOUR}/search`,
      `/uniqlo/${SEO}/search`,
      `//zara/${SEO}/search`,
    ]) {
      expect(upstreamUrl(path), path).toBeNull();
    }
  });

  it('asks Zara for the core URL only, with our headers, never the query string', async () => {
    const { d, fetchImpl } = deps(upstream(SEARCH));
    const res = await handle(get(`/zara/${SEO}/search?query=99999998&url=https://evil.example/`, { origin: SITE, headers: { Cookie: 'a=1' } }), d);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SEARCH);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(fetchImpl.mock.calls[0]![0]).toBe(zaraUrls.search(SEO));
    const init = fetchImpl.mock.calls[0]![1]!;
    expect(Object.fromEntries(new Headers(init.headers))).toEqual({ 'user-agent': USER_AGENT, accept: 'application/json' });
    expect(init.redirect).toBe('manual');
  });

  it('caches a SUCCESS search and a guide with measurements for 24 h', async () => {
    const search = deps(upstream(SEARCH));
    await handle(get(`/zara/${SEO}/search`), search.d);
    await search.settle();
    expect([...search.cache!.store.keys()]).toEqual([zaraUrls.search(SEO)]);
    await handle(get(`/zara/${SEO}/search`), search.d);
    expect(search.fetchImpl).toHaveBeenCalledTimes(1);

    const guide = deps(upstream(GUIDE));
    const res = await handle(get(`/zara/${COLOUR}/size-guide`), guide.d);
    await guide.settle();
    expect(res.headers.get('Cache-Control')).toBe(`public, max-age=${CACHE_SECONDS}`);
    expect([...guide.cache!.store.keys()]).toEqual([zaraUrls.sizeGuide(COLOUR)]);
  });

  it('passes a guide 404 on as it is (status and body), uncached', async () => {
    const { d, cache, settle } = deps(upstream(NO_GUIDE, 404));
    const res = await handle(get('/zara/616513990/size-guide', { origin: SITE }), d);
    await settle();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(NO_GUIDE);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(cache!.put).not.toHaveBeenCalled();
  });

  it('does not cache any other answer', async () => {
    const cases: [string, string, number][] = [
      ['search', '{"status":"ERROR"}', 200],
      ['search', '{"status":"ok"}', 200],
      ['search', '<html>Access Denied</html>', 403],
      ['search', '<html>Access Denied</html>', 200],
      ['size-guide', '{"sizeGuideInfo":null,"measureGuideInfo":null}', 200],
      ['size-guide', '{"measureGuideInfo":[]}', 200],
      ['size-guide', '{"status":"SUCCESS"}', 200],
      ['size-guide', GUIDE, 429],
    ];
    for (const [route, body, status] of cases) {
      const id = route === 'search' ? SEO : COLOUR;
      const { d, cache, settle } = deps(upstream(body, status));
      const res = await handle(get(`/zara/${id}/${route}`), d);
      await settle();
      expect(res.status, `${route} ${body}`).toBe(status);
      expect(cache!.put, `${route} ${body}`).not.toHaveBeenCalled();
    }
  });

  it('does not cache a Uniqlo-shaped "ok" on a Zara route, or a Zara SUCCESS on a Uniqlo one', async () => {
    const zara = deps(upstream(OK));
    await handle(get(`/zara/${SEO}/search`), zara.d);
    await zara.settle();
    expect(zara.cache!.put).not.toHaveBeenCalled();

    const uniqlo = deps(upstream(SEARCH));
    await handle(get(`/uniqlo/${CODE}/details`), uniqlo.d);
    await uniqlo.settle();
    expect(uniqlo.cache!.put).not.toHaveBeenCalled();
  });

  it('answers 502 for a Zara redirect, never following it', async () => {
    const moved = vi.fn(() => Promise.resolve(new Response(null, { status: 301, headers: { Location: 'https://www.zara.com/us/en/' } })));
    const res = await handle(get(`/zara/${SEO}/search`), deps(moved).d);
    expect(res.status).toBe(502);
    expect(moved).toHaveBeenCalledTimes(1);
  });
});

describe('what goes to Uniqlo', () => {
  it('a plain User-Agent and Accept, never the visitor’s headers, cookies or IP', async () => {
    const { d, fetchImpl } = deps();
    await handle(
      get(`/uniqlo/${CODE}/details`, {
        origin: SITE,
        headers: { Cookie: 'a=1', 'User-Agent': 'Mozilla/5.0 visitor', 'X-Forwarded-For': '203.0.113.9', 'CF-Connecting-IP': '203.0.113.9', Referer: SITE },
      }),
      d,
    );
    const init = fetchImpl.mock.calls[0]![1]!;
    expect(Object.fromEntries(new Headers(init.headers))).toEqual({ 'user-agent': USER_AGENT, accept: 'application/json' });
    expect(init.method ?? 'GET').toBe('GET');
    expect(init).not.toHaveProperty('body');
    expect(init.redirect).toBe('manual');
  });
});

describe('responses', () => {
  it('is JSON, and never passes on Uniqlo’s cookies', async () => {
    const { d } = deps();
    const res = await handle(get(`/uniqlo/${CODE}/details`, { origin: SITE }), d);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('passes an upstream error status and body on as they are, and does not cache them', async () => {
    const { d, cache, settle } = deps(upstream(MISSING, 404));
    const res = await handle(get(`/uniqlo/${CODE}/details`, { origin: SITE }), d);
    await settle();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(MISSING);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(cache!.put).not.toHaveBeenCalled();
  });

  it('passes on a 5xx too', async () => {
    const { d } = deps(upstream('<html>busy</html>', 503));
    const res = await handle(get(`/uniqlo/${CODE}/size-chart`), d);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('<html>busy</html>');
  });

  it('answers 504 when Uniqlo takes longer than 8 s', async () => {
    vi.useFakeTimers();
    const hang = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    const { d } = deps(hang);
    const pending = handle(get(`/uniqlo/${CODE}/details`, { origin: SITE }), d);
    await vi.advanceTimersByTimeAsync(7_999);
    let done = false;
    void pending.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ status: 'error', reason: 'timeout' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });

  it('answers 502 when Uniqlo cannot be reached, or redirects elsewhere', async () => {
    const down = vi.fn(() => Promise.reject(new TypeError('connection refused')));
    const r1 = await handle(get(`/uniqlo/${CODE}/details`), deps(down).d);
    expect(r1.status).toBe(502);
    expect(await r1.json()).toEqual({ status: 'error', reason: 'upstream' });

    const moved = vi.fn(() => Promise.resolve(new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example/' } })));
    const r2 = await handle(get(`/uniqlo/${CODE}/details`), deps(moved).d);
    expect(r2.status).toBe(502);
    expect(r2.headers.get('Location')).toBeNull();
    expect(moved).toHaveBeenCalledTimes(1);
  });
});

describe('CORS', () => {
  it('lets exactly the site and the local Vite servers read it', () => {
    expect([...ALLOWED_ORIGINS].sort()).toEqual(
      ['https://yoshiryo2.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'].sort(),
    );
  });

  it('names an allowed origin, and varies on Origin', async () => {
    for (const origin of ALLOWED_ORIGINS) {
      const res = await handle(get(`/uniqlo/${CODE}/details`, { origin }), deps().d);
      expect(res.headers.get('Access-Control-Allow-Origin'), origin).toBe(origin);
      expect(res.headers.get('Vary')).toBe('Origin');
    }
  });

  it('gives any other origin (or none) no CORS header', async () => {
    for (const origin of [undefined, 'https://evil.example', 'https://yoshiryo2.github.io.evil.example', 'http://yoshiryo2.github.io', 'http://localhost:3000', 'null']) {
      const res = await handle(get(`/uniqlo/${CODE}/details`, origin ? { origin } : {}), deps().d);
      expect(res.headers.get('Access-Control-Allow-Origin'), String(origin)).toBeNull();
    }
  });

  it('answers a preflight for an allowed route, without calling Uniqlo', async () => {
    const { d, fetchImpl } = deps();
    const res = await handle(
      get(`/uniqlo/${CODE}/details`, { method: 'OPTIONS', origin: SITE, headers: { 'Access-Control-Request-Method': 'GET' } }),
      d,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
    expect(fetchImpl).not.toHaveBeenCalled();

    const other = await handle(get(`/uniqlo/${CODE}/details`, { method: 'OPTIONS', origin: 'https://evil.example' }), d);
    expect(other.status).toBe(204);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await handle(get('/elsewhere', { method: 'OPTIONS', origin: SITE }), d)).status).toBe(404);
  });

  it('adds CORS to 404s and 405s for an allowed origin, so the site can read the reason', async () => {
    const { d } = deps();
    expect((await handle(get('/nope', { origin: SITE }), d)).headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect((await handle(get(`/uniqlo/${CODE}/details`, { method: 'POST', origin: SITE }), d)).headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });
});

describe('cache', () => {
  it('keeps an ok answer for 24 h under the upstream URL, then serves it without calling Uniqlo', async () => {
    const { d, fetchImpl, cache, settle } = deps();
    await handle(get(`/uniqlo/${CODE}/details`, { origin: SITE }), d);
    await settle();
    expect(cache!.put).toHaveBeenCalledTimes(1);
    const [key, stored] = cache!.put.mock.calls[0]!;
    expect(key.url).toBe(uniqloUrls(CODE).details);
    expect(stored.headers.get('Cache-Control')).toBe(`public, max-age=${CACHE_SECONDS}`);
    expect(CACHE_SECONDS).toBe(24 * 60 * 60);
    // Stored without CORS or cookies: those are added per request.
    expect(stored.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(stored.headers.get('Set-Cookie')).toBeNull();

    const again = await handle(get(`/uniqlo/${CODE}/details`, { origin: 'http://localhost:5173' }), d);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(again.status).toBe(200);
    expect(await again.text()).toBe(OK);
    expect(again.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('keeps the size chart and the details apart', async () => {
    const { d, cache, settle } = deps();
    await handle(get(`/uniqlo/${CODE}/details`), d);
    await handle(get(`/uniqlo/${CODE}/size-chart`), d);
    await settle();
    expect([...cache!.store.keys()].sort()).toEqual([uniqloUrls(CODE).details, uniqloUrls(CODE).sizeChart].sort());
  });

  it('does not cache a 200 whose status is not "ok", or that is not JSON', async () => {
    for (const body of [MISSING, '{"status":"error"}', 'not json', '']) {
      const { d, cache, settle } = deps(upstream(body, 200));
      const res = await handle(get(`/uniqlo/${CODE}/details`), d);
      await settle();
      expect(res.status, body).toBe(200);
      expect(cache!.put, body).not.toHaveBeenCalled();
    }
  });

  it('still answers when the cache fails or there is none', async () => {
    const broken = fakeCache();
    broken.match.mockRejectedValue(new Error('cache down'));
    broken.put.mockRejectedValue(new Error('cache down'));
    const { d, settle } = deps(upstream(), broken);
    const res = await handle(get(`/uniqlo/${CODE}/details`), d);
    await settle();
    expect(res.status).toBe(200);
    expect((await handle(get(`/uniqlo/${CODE}/details`), deps(upstream(), null).d)).status).toBe(200);
  });
});
