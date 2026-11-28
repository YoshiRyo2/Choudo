import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { fitAllSizes, preferenceSpec } from '@choudo/core/domain/fit';
import { templateOf } from '@choudo/core/domain/garments';
import { parseProductLink, readyFetchedGarment, zaraToSeedGarment, zaraUrls, type ZaraLink } from '@choudo/core/domain/links';
import guide from '@choudo/core/domain/links/__fixtures__/zara-guide-616513993.json';
import missingGuide from '@choudo/core/domain/links/__fixtures__/zara-guide-missing.json';
import search from '@choudo/core/domain/links/__fixtures__/zara-search-04174639.json';
import noMatch from '@choudo/core/domain/links/__fixtures__/zara-search-no-match.json';
import { fittingHeadline, reliabilityText, whyLine } from '@choudo/core/ui-logic/fitText';
import { reliability } from '@choudo/core/ui-logic/reliability';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { STORAGE_KEYS, type Outfit, type StoredFetched } from '@choudo/core/ui-logic/state/stored';

import { brush, byTestId, nodes, type Node } from '@/components/mannequin/svg-tree';
import { forgetThisLaunch } from '@/hooks/use-persistent-state';

// The Check tab with a Zara link (Uniqlo's are in check-route.test.tsx).
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })) }));

const appDir = './src/app';
const NAVY_URL = 'https://www.zara.com/us/en/interlock-long-sleeve-t-shirt-p04174639.html?v1=616513993';
const NAVY_PHOTO =
  'https://static.zara.net/assets/public/dbac/ddca/22954b569097/d4c2aec298bf/04174639401-p/04174639401-p.jpg?ts=1795509515737&w=750';
const BLACK_PHOTO =
  'https://static.zara.net/assets/public/0f3a/6dc2/0b8149efa359/b325e50d501b/04174639800-p/04174639800-p.jpg?ts=1795509507255&w=750';
const WOMENS: BodyInput = { heightCm: 163, weightKg: 56, bodyType: 'womens' };
const model = estimateBody(WOMENS);
const preference = preferenceSpec(null, null);
const read = <T,>(key: string): T => JSON.parse(Storage.getItemSync(key)!) as T;

const converted = zaraToSeedGarment(search, guide, parseProductLink(NAVY_URL) as ZaraLink, '2026-11-28');
if (!converted.ok) throw new Error(converted.reason);
const tee = readyFetchedGarment(converted.garment)!;
const odds = garmentOdds(model, tee, preference);
const fits = fitAllSizes(model, tee);

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);
let fetchMock: jest.Mock;

/** Zara itself: the search for 04174639 and a size guide for any colour id. */
function answerWith(by: { search?: () => Promise<Response>; guide?: () => Promise<Response> } = {}) {
  fetchMock = jest.fn((url: string) => {
    if (url === zaraUrls.search('04174639')) return by.search ? by.search() : reply(search);
    if (url.includes('/size-measure-guide')) return by.guide ? by.guide() : reply(guide);
    if (url.includes('/search/')) return reply(noMatch);
    return Promise.reject(new TypeError(`unexpected ${url}`));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

async function open() {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(WOMENS));
  await renderRouter(appDir, { initialUrl: '/' });
}

async function checkLink(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Paste a Uniqlo or Zara link'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Check size' }));
  await act(async () => {
    await Promise.resolve();
  });
}

const result = () => within(screen.getByTestId('check-result'));
const errorText = () => within(screen.getByTestId('check-error'));
/** True when the tree under this testID paints a path in `hex`. */
const paints = (testID: string, hex: string) =>
  nodes(byTestId(screen.toJSON() as unknown as Node, testID)!, 'RNSVGPath').some((p) => JSON.stringify(p.props.fill) === JSON.stringify(brush(hex)));

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  answerWith();
});

test('a Zara link: reading Zara’s chart, then the product, the answer, the why-line and the confidence line', async () => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  answerWith({ search: () => held.then(() => reply(search)) });
  await open();
  await fireEvent.changeText(screen.getByLabelText('Paste a Uniqlo or Zara link'), `Is this my size? ${NAVY_URL}`);
  await fireEvent.press(screen.getByRole('button', { name: 'Check size' }));
  expect(screen.getByTestId('check-loading')).toHaveTextContent('Reading Zara’s size chart…');
  await act(async () => {
    release();
    await held;
  });
  // Zara's two addresses, one after the other, with the link's number and the colour id: nothing about the body.
  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([zaraUrls.search('04174639'), zaraUrls.sizeGuide(616513993)]);

  const r = result();
  expect(r.getByRole('header', { name: 'Interlock Long-Sleeve T-Shirt' })).toBeTruthy();
  expect(r.getByText('$17.94 · Navy Blue · Long sleeve')).toBeTruthy();
  expect(r.getByTestId('check-photo').props.source).toEqual({ uri: NAVY_PHOTO });
  expect(r.getByText('Photo: Zara')).toBeTruthy();
  expect(paints('check-preview', '#252731')).toBe(true);
  const size = odds.recommended!;
  const fit = fits.find((f) => f.sizeLabel === size)!;
  expect(r.getByText(fittingHeadline(odds, size, tee).headline)).toBeTruthy();
  expect(r.getByTestId('fit-answer-why')).toHaveTextContent(whyLine(fits, size, templateOf(tee), 'metric', fit.bodyType)!);
  expect(r.getByTestId('fit-answer-trust')).toHaveTextContent(reliabilityText(reliability(fit, tee, { hasFitReference: false }), fit.bodyType), {
    exact: false,
  });
  expect(r.getAllByRole('radio', { name: /^(Navy Blue|Green|Ecru|Black)$/ })).toHaveLength(4);
  expect(read<StoredFetched[]>(STORAGE_KEYS.fetched).map((e) => e.product.garment.id)).toEqual(['zara-04174639']);
});

test('a colour chip switches the photo and the drawing, and is stored with the product', async () => {
  await open();
  await checkLink(NAVY_URL);
  await fireEvent.press(result().getByRole('radio', { name: 'Black' }));
  expect(result().getByTestId('check-photo').props.source).toEqual({ uri: BLACK_PHOTO });
  expect(paints('check-preview', '#121315')).toBe(true);
  expect(read<StoredFetched[]>(STORAGE_KEYS.fetched)[0]!.product).toMatchObject({ colorCode: '800', colorName: 'Black', garment: { color: '#121315' } });
});

test('Try it on wears it in the Fitting room, tagged as from the link', async () => {
  await open();
  await checkLink(NAVY_URL);
  await fireEvent.press(result().getByRole('button', { name: 'Try it on' }));
  expect(screen).toHavePathname('/fitting-room');
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ topId: 'zara-04174639', topSize: odds.recommended });
  expect(screen.getAllByText('Interlock Long-Sleeve T-Shirt').length).toBeGreaterThan(0);
  expect(screen.getAllByText('From your link').length).toBeGreaterThan(0);
});

test('Open at Zara opens the product page', async () => {
  await open();
  await checkLink(NAVY_URL);
  await act(() => fireEvent.press(result().getByRole('button', { name: 'Open at Zara' })));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(NAVY_URL);
});

test('Zara turning the phone away: the same request once through the fetch service', async () => {
  fetchMock = jest.fn((url: string) => {
    if (url.startsWith('https://www.zara.com/')) return reply('<html>Access Denied</html>', 403);
    if (url.endsWith('/zara/04174639/search')) return reply(search);
    if (url.endsWith('/zara/616513993/size-guide')) return reply(guide);
    return Promise.reject(new TypeError(`unexpected ${url}`));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await open();
  await checkLink(NAVY_URL);
  expect(result().getByRole('header', { name: 'Interlock Long-Sleeve T-Shirt' })).toBeTruthy();
  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
    zaraUrls.search('04174639'),
    'https://choudo-fetch.ryodyoshida.workers.dev/zara/04174639/search',
    zaraUrls.sizeGuide(616513993),
    'https://choudo-fetch.ryodyoshida.workers.dev/zara/616513993/size-guide',
  ]);
});

describe('errors', () => {
  test('no product with that number', async () => {
    await open();
    await checkLink('https://www.zara.com/us/en/-p99999998.html');
    expect(errorText().getByText('Zara has no product at this link. Paste another product link.')).toBeTruthy();
    expect(errorText().queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  test('a product without a size guide', async () => {
    answerWith({ guide: () => reply(missingGuide, 404) });
    await open();
    await checkLink(NAVY_URL);
    expect(errorText().getByText('Zara doesn’t list garment measurements for this product. Try another one.')).toBeTruthy();
  });

  test('Zara outside the US', async () => {
    await open();
    await checkLink('https://www.zara.com/es/en/-p04174639.html');
    expect(errorText().getByText('Only Zara US links for now.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('blocked directly and through the service: Couldn’t reach Zara, with Retry', async () => {
    // Zara and the fetch service both answer 403.
    fetchMock.mockImplementation(() => reply('denied', 403));
    await open();
    await checkLink(NAVY_URL);
    expect(errorText().getByText('Couldn’t reach Zara. Check your connection and try again.')).toBeTruthy();
    expect(errorText().getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
