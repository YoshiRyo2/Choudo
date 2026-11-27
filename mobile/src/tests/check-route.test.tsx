import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { fitAllSizes, preferenceSpec } from '@choudo/core/domain/fit';
import { templateOf } from '@choudo/core/domain/garments';
import { parseProductLink, readyFetchedGarment, uniqloToSeedGarment, uniqloUrls, type UniqloLink } from '@choudo/core/domain/links';
import sizeChart from '@choudo/core/domain/links/__fixtures__/uniqlo-size-charts-E424873-000.json';
import product from '@choudo/core/domain/links/__fixtures__/uniqlo-details-E424873-000.json';
import { fittingHeadline, reliabilityText, whyLine } from '@choudo/core/ui-logic/fitText';
import { reliability } from '@choudo/core/ui-logic/reliability';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Outfit, type StoredFetched } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })) }));

const appDir = './src/app';
const TEE_URL = 'https://www.uniqlo.com/us/en/products/E424873-000/00';
const WOMENS: BodyInput = { heightCm: 163, weightKg: 56, bodyType: 'womens' };
const model = estimateBody(WOMENS);
const preference = preferenceSpec(null, null);
const urls = uniqloUrls('E424873-000');
const read = <T,>(key: string): T => JSON.parse(Storage.getItemSync(key)!) as T;

// The garment the fixtures become, worked out the same way the screen does.
const link = parseProductLink(TEE_URL) as UniqloLink;
const converted = uniqloToSeedGarment(sizeChart, product, link, '2026-11-26');
if (!converted.ok) throw new Error(converted.reason);
const tee = readyFetchedGarment(converted.garment)!;
const odds = garmentOdds(model, tee, preference);
const fits = fitAllSizes(model, tee);
const linesFor = (size: string) => {
  const fit = fits.find((f) => f.sizeLabel === size)!;
  return {
    headline: fittingHeadline(odds, size, tee).headline,
    why: whyLine(fits, size, templateOf(tee), 'metric', fit.bodyType),
    trust: reliabilityText(reliability(fit, tee, { hasFitReference: false }), fit.bodyType),
  };
};

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);
let fetchMock: jest.Mock;

function answerWith(by: { chart?: () => Promise<Response>; product?: () => Promise<Response> } = {}) {
  fetchMock = jest.fn((url: string) => {
    if (url === urls.sizeChart) return by.chart ? by.chart() : reply(sizeChart);
    if (url === urls.details) return by.product ? by.product() : reply(product);
    return Promise.reject(new TypeError(`unexpected ${url}`));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

async function open(body: BodyInput = WOMENS) {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(body));
  await renderRouter(appDir, { initialUrl: '/' });
}

/** Paste `text` and press Check size, then let the requests finish. */
async function checkLink(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Paste a Uniqlo link'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Check size' }));
  await act(async () => {
    await Promise.resolve();
  });
}

const result = () => within(screen.getByTestId('check-result'));
const errorText = () => within(screen.getByTestId('check-error'));

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  answerWith();
});

test('opens on the Check tab with the field, the button and what it works with', async () => {
  await open();
  expect(screen).toHavePathname('/check');
  expect(screen.getByRole('header', { name: 'What size should I buy?' })).toBeTruthy();
  expect(screen.getByLabelText('Paste a Uniqlo link')).toBeTruthy();
  expect(screen.getByText('Works with Uniqlo US tops for now.')).toBeTruthy();
  expect(screen.queryByTestId('check-result')).toBeNull();
});

test('a first run (no body) gets the same Body step as the rest of the app', async () => {
  await renderRouter(appDir, { initialUrl: '/check' });
  expect(screen).toHavePathname('/body');
});

test('a Uniqlo link: reading shows inline, then the product, the answer, the why-line and the confidence line', async () => {
  // Hold the size chart until the loading line has been seen.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  answerWith({ chart: () => held.then(() => reply(sizeChart)) });
  await open();
  await fireEvent.changeText(screen.getByLabelText('Paste a Uniqlo link'), `Is this my size? ${TEE_URL}?colorDisplayCode=00`);
  await fireEvent.press(screen.getByRole('button', { name: 'Check size' }));
  expect(screen.getByTestId('check-loading')).toHaveTextContent('Reading Uniqlo’s size chart…');
  await act(async () => {
    release();
    await held;
  });
  expect(screen.queryByTestId('check-loading')).toBeNull();
  // Only Uniqlo's two addresses, with the product code: nothing about the body.
  expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([urls.details, urls.sizeChart].sort());

  const r = result();
  expect(r.getByRole('header', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  expect(r.getByText('$14.90')).toBeTruthy();
  expect(r.getByTestId('check-thumb').props.source).toEqual({ uri: 'https://image.uniqlo.com/UQ/ST3/us/imagesgoods/424873/item/usgoods_00_424873_3x4.jpg' });
  expect(odds.recommended).not.toBeNull();
  const lines = linesFor(odds.recommended!);
  expect(r.getByText(lines.headline)).toBeTruthy();
  expect(r.getByTestId('fit-answer-why')).toHaveTextContent(lines.why!);
  expect(r.getByTestId('fit-answer-trust')).toHaveTextContent(lines.trust, { exact: false });
  expect(r.getByRole('radio', { name: new RegExp(`^${odds.recommended}, .*suggested size`) })).toBeTruthy();

  // Stored on the phone: the cache and the Fitting room's "From your link" garment.
  const stored = read<StoredFetched[]>(STORAGE_KEYS.fetched);
  expect(stored.map((e) => e.product.garment.id)).toEqual(['uniqlo-E424873-000']);
  expect(stored[0]!.product.productUrl).toBe(TEE_URL);
});

test('tapping another size chip changes the headline, why-line and confidence line', async () => {
  await open();
  await checkLink(TEE_URL);
  const other = tee.sizes.map((s) => s.label).find((s) => s !== odds.recommended)!;
  await fireEvent.press(result().getByRole('radio', { name: new RegExp(`^${other}, `) }));
  const lines = linesFor(other);
  expect(result().getByText(lines.headline)).toBeTruthy();
  expect(result().getByTestId('fit-answer-why')).toHaveTextContent(lines.why!);
  expect(result().getByTestId('fit-answer-trust')).toHaveTextContent(lines.trust, { exact: false });
  expect(result().getByRole('radio', { name: new RegExp(`^${other}, `) }).props.accessibilityState).toMatchObject({ selected: true });
});

test('Try it on wears it in the shown size and switches to the Fitting room, tagged as from the link', async () => {
  await open();
  await checkLink(TEE_URL);
  const other = tee.sizes.map((s) => s.label).find((s) => s !== odds.recommended)!;
  await fireEvent.press(result().getByRole('radio', { name: new RegExp(`^${other}, `) }));
  await fireEvent.press(result().getByRole('button', { name: 'Try it on' }));
  expect(screen).toHavePathname('/fitting-room');
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ topId: 'uniqlo-E424873-000', topSize: other });
  const stage = within(screen.getByTestId('stage'));
  expect(stage.getByLabelText(/^Mannequin, 163 cm tall/)).toBeTruthy();
  expect(screen.getAllByText('Crew Neck T-Shirt').length).toBeGreaterThan(0);
  expect(screen.getAllByText('From your link').length).toBeGreaterThan(0);
});

test('Open at Uniqlo opens the product page', async () => {
  await open();
  await checkLink(TEE_URL);
  await act(() => fireEvent.press(result().getByRole('button', { name: 'Open at Uniqlo' })));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(TEE_URL);
});

test('a second check of the same product within 7 days reads the stored copy', async () => {
  await open();
  await checkLink(TEE_URL);
  fetchMock.mockClear();
  await checkLink(TEE_URL);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(result().getByRole('header', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
});

describe('errors', () => {
  test('no link', async () => {
    await open();
    await checkLink('crew neck tee in M');
    expect(errorText().getByText('Paste a product link from uniqlo.com.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('another brand: says so and remembers the host (shown in Test mode only)', async () => {
    Storage.setItemSync(STORAGE_KEYS.testMode, 'true');
    await open();
    await checkLink('https://www.zara.com/us/en/linen-shirt-p04174639.html');
    expect(errorText().getByText('Choudo can read Uniqlo links for now. More brands soon.')).toBeTruthy();
    expect(read<string[]>(STORAGE_KEYS.unsupportedHosts)).toEqual(['www.zara.com']);
    expect(screen.getByTestId('unsupported-hosts')).toHaveTextContent('Unsupported hosts: www.zara.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('Uniqlo outside the US', async () => {
    await open();
    await checkLink('https://www.uniqlo.com/jp/ja/products/E424873-000/00');
    expect(errorText().getByText('Only Uniqlo US links for now.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('offline: the message with Retry, and Retry tries again', async () => {
    answerWith({ chart: () => Promise.reject(new TypeError('offline')), product: () => Promise.reject(new TypeError('offline')) });
    await open();
    await checkLink(TEE_URL);
    expect(errorText().getByText('Couldn’t reach Uniqlo. Check your connection and try again.')).toBeTruthy();
    answerWith();
    await fireEvent.press(errorText().getByRole('button', { name: 'Retry' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result().getByRole('header', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  });

  test('blocked (an error status) reads the same', async () => {
    answerWith({ chart: () => reply('denied', 403) });
    await open();
    await checkLink(TEE_URL);
    expect(errorText().getByText('Couldn’t reach Uniqlo. Check your connection and try again.')).toBeTruthy();
    expect(errorText().getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  test('offline with a product checked before: it still shows, from the stored copy', async () => {
    await open();
    await checkLink(TEE_URL);
    // Stale (8 days old), then offline.
    const stored = read<StoredFetched[]>(STORAGE_KEYS.fetched).map((e) => ({ ...e, fetchedAt: '2026-01-01T00:00:00.000Z' }));
    Storage.setItemSync(STORAGE_KEYS.fetched, JSON.stringify(stored));
    forgetThisLaunch();
    answerWith({ chart: () => Promise.reject(new TypeError('offline')), product: () => Promise.reject(new TypeError('offline')) });
    await renderRouter(appDir, { initialUrl: '/' });
    await checkLink(TEE_URL);
    expect(result().getByRole('header', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  });

  test('not a top', async () => {
    const pants = { ...sizeChart, result: [{ ...sizeChart.result[0]!, sizeChart: sizeChart.result[0]!.sizeChart.map((s) => ({ ...s, sizeParts: [] })) }] };
    answerWith({ chart: () => reply(pants) });
    await open();
    await checkLink(TEE_URL);
    expect(errorText().getByText('Choudo can only check tops from Uniqlo for now.')).toBeTruthy();
    expect(errorText().queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

test('recent checks: the stored products are listed, and a tap shows one again from storage', async () => {
  await open();
  await checkLink(TEE_URL);
  // A second product, so the first is in the recent list.
  const second = 'E000001-000';
  const secondUrls = uniqloUrls(second);
  const renamed = { ...product, result: { ...product.result, productId: second, name: 'Supima Cotton T-Shirt' } };
  fetchMock = jest.fn((url: string) => (url === secondUrls.sizeChart ? reply(sizeChart) : url === secondUrls.details ? reply(renamed) : reply(product)));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await checkLink(`https://www.uniqlo.com/us/en/products/${second}`);
  expect(result().getByRole('header', { name: 'Supima Cotton T-Shirt' })).toBeTruthy();
  fetchMock.mockClear();
  await fireEvent.press(within(screen.getByTestId('check-recent')).getByRole('button', { name: 'Uniqlo Crew Neck T-Shirt' }));
  expect(result().getByRole('header', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a stored fetched garment that fails the checks is dropped, and an outfit wearing it falls back', async () => {
  const broken: StoredFetched = { product: { ...converted.product, garment: { ...converted.garment, sizes: [] } }, fetchedAt: '2026-11-26T00:00:00.000Z' };
  Storage.setItemSync(STORAGE_KEYS.fetched, JSON.stringify([broken]));
  Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify({ ...EMPTY_OUTFIT, topId: 'uniqlo-E424873-000', topSize: 'M' }));
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(WOMENS));
  await renderRouter(appDir, { initialUrl: '/fitting-room' });
  expect(screen.queryByText('From your link')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Uniqlo Crew Neck T-Shirt' })).toBeNull();
  // Storage is left as it was.
  expect(read<Outfit>(STORAGE_KEYS.outfit).topId).toBe('uniqlo-E424873-000');
});
