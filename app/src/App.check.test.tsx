// @vitest-environment jsdom
// The Check tab on the website, end to end through App (the phone's src/tests/check-route.test.tsx).
import './ui/test/dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { fitAllSizes, preferenceSpec } from '@choudo/core/domain/fit';
import { templateOf } from '@choudo/core/domain/garments';
import { parseProductLink, readyFetchedGarment, uniqloToSeedGarment, type UniqloLink } from '@choudo/core/domain/links';
import { colorHex } from '@choudo/core/domain/links/colors';
import sizeChart from '@choudo/core/domain/links/__fixtures__/uniqlo-size-charts-E424873-000.json';
import product from '@choudo/core/domain/links/__fixtures__/uniqlo-details-E424873-000.json';
import { fittingHeadline, reliabilityText, whyLine } from '@choudo/core/ui-logic/fitText';
import { reliability } from '@choudo/core/ui-logic/reliability';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Outfit, type StoredFetched } from '@choudo/core/ui-logic/state/stored';
import { App } from './App';
import { serviceUrls } from './links/fetchUniqlo';
import { track } from './ui/analytics';

vi.mock('./ui/analytics', async (original) => ({ ...(await original<typeof import('./ui/analytics')>()), track: vi.fn() }));

const TEE_URL = 'https://www.uniqlo.com/us/en/products/E424873-000/00';
const BLACK_URL = 'https://www.uniqlo.com/us/en/products/E424873-000/09';
const WOMENS: BodyInput = { heightCm: 163, weightKg: 56, bodyType: 'womens' };
const model = estimateBody(WOMENS);
const preference = preferenceSpec(null, null);
const urls = serviceUrls('E424873-000');
const read = <T,>(key: string): T => JSON.parse(localStorage.getItem(key)!) as T;
const store = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

// The garment the fixtures become, worked out the same way the screen does.
const converted = uniqloToSeedGarment(sizeChart, product, parseProductLink(TEE_URL) as UniqloLink, '2026-11-26');
if (!converted.ok) throw new Error(converted.reason);
const tee = readyFetchedGarment(converted.garment)!;
const odds = garmentOdds(model, tee, preference);
const fits = fitAllSizes(model, tee);
const linesFor = (size: string) => {
  const fit = fits.find((f) => f.sizeLabel === size)!;
  return {
    headline: fittingHeadline(odds, size, tee).headline,
    why: whyLine(fits, size, templateOf(tee), 'metric', fit.bodyType)!,
    trust: reliabilityText(reliability(fit, tee, { hasFitReference: false }), fit.bodyType),
  };
};

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);
let fetchMock: Mock;

function answerWith(by: { chart?: () => Promise<Response>; product?: () => Promise<Response> } = {}) {
  fetchMock = vi.fn((url: string) => {
    if (url === urls.sizeChart) return by.chart ? by.chart() : reply(sizeChart);
    if (url === urls.details) return by.product ? by.product() : reply(product);
    return Promise.reject(new TypeError(`unexpected ${url}`));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

function open(body: BodyInput | null = WOMENS) {
  if (body) store(STORAGE_KEYS.body, body);
  render(<App />);
}

const field = () => screen.getByRole('textbox', { name: 'Paste a Uniqlo link' }) as HTMLInputElement;

/** Paste `text` and press Check size, then let the requests finish. */
async function checkLink(text: string) {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Check size' }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const result = () => within(screen.getByTestId('check-result'));
const errorText = () => screen.getByTestId('check-error').textContent;
const answer = () => {
  const card = screen.getByTestId('check-result');
  const text = (selector: string) => card.querySelector(selector)?.textContent ?? '';
  return { headline: text('.fit-answer__headline'), why: text('.fit-answer__why'), trust: text('.fit-answer__trust') };
};
/** True when the drawing under this element paints a garment in `hex`. */
const paints = (root: Element, hex: string) =>
  [...root.querySelectorAll<SVGElement>('[style]')].some((el) => el.style.fill.toLowerCase() === hex.toLowerCase() || el.style.fill === rgb(hex));
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(track).mockClear();
  answerWith();
});

afterEach(() => {
  cleanup();
});

it('opens on the Check tab with the field, the button and what it works with', () => {
  open();
  expect(screen.getByRole('heading', { level: 1, name: 'What size should I buy?' })).toBeTruthy();
  expect(field()).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Check size' })).toBeTruthy();
  expect(screen.getByText('Works with Uniqlo US tops for now.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Check/, current: 'page' })).toBeTruthy();
  // Stored data from before the Check tab (no fetched keys) loads fine.
  expect(localStorage.getItem(STORAGE_KEYS.fetched)).toBeNull();
});

it('a first run (no body) gets the Body screen, as before', () => {
  open(null);
  expect(screen.queryByRole('textbox', { name: 'Paste a Uniqlo link' })).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
});

it('a Uniqlo link: reading shows inline, then the product, the answer, the why-line and the confidence line', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  answerWith({ chart: () => gate.then(() => reply(sizeChart)) });
  open();
  fireEvent.change(field(), { target: { value: TEE_URL } });
  fireEvent.click(screen.getByRole('button', { name: 'Check size' }));
  expect(screen.getByTestId('check-loading').textContent).toBe('Reading Uniqlo’s size chart…');
  // Only the product code went out, to the fetch service.
  expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([urls.details, urls.sizeChart].sort());
  await act(async () => {
    release();
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(result().getByRole('heading', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  const lines = linesFor(odds.recommended!);
  expect(answer().headline).toBe(lines.headline);
  expect(answer().why).toBe(lines.why);
  expect(answer().trust).toContain(lines.trust);
  // Stored on this device, as the phone does.
  expect(read<StoredFetched[]>(STORAGE_KEYS.fetched)[0]!.product.garment.id).toBe('uniqlo-E424873-000');
  expect(track).toHaveBeenCalledWith('link-checked');
});

it('Enter in the field checks (the form submits)', async () => {
  open();
  fireEvent.change(field(), { target: { value: TEE_URL } });
  fireEvent.submit(field().form!);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(result().getByRole('heading', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
});

it('choosing another size changes the headline, why-line and confidence line', async () => {
  open();
  await checkLink(TEE_URL);
  const other = fits.map((f) => f.sizeLabel).find((s) => s !== odds.recommended)!;
  fireEvent.click(result().getByRole('radio', { name: new RegExp(`^${other}\\b`) }));
  const lines = linesFor(other);
  expect(answer().headline).toBe(lines.headline);
  expect(answer().why).toBe(lines.why);
  expect(answer().trust).toContain(lines.trust);
});

it('Try it on wears it in the shown size and goes to the Fitting room, tagged as from the link, once', async () => {
  open();
  await checkLink(TEE_URL);
  fireEvent.click(result().getByRole('button', { name: 'Try it on' }));
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ topId: 'uniqlo-E424873-000', topSize: odds.recommended });
  expect(screen.getByRole('button', { name: /Fitting room/, current: 'page' })).toBeTruthy();
  const tops = within(screen.getByRole('list', { name: 'Tops' }));
  expect(tops.getAllByText('Crew Neck T-Shirt')).toHaveLength(1);
  expect(tops.getAllByText('From your link')).toHaveLength(1);
  expect(tops.getByRole('button', { name: /Crew Neck T-Shirt/, pressed: true })).toBeTruthy();
});

it('Open at Uniqlo is a link to the product page, in a new tab with no opener or referrer', async () => {
  open();
  await checkLink(BLACK_URL);
  const linkEl = result().getByRole('link', { name: 'Open at Uniqlo' });
  expect(linkEl.getAttribute('href')).toBe(BLACK_URL);
  expect(linkEl.getAttribute('target')).toBe('_blank');
  expect(linkEl.getAttribute('rel')).toBe('noopener noreferrer');
});

it('a second check of the same product within 7 days reads the stored copy', async () => {
  open();
  await checkLink(TEE_URL);
  fetchMock.mockClear();
  await checkLink(TEE_URL);
  expect(result().getByRole('heading', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

describe('errors', () => {
  it('no link', async () => {
    open();
    await checkLink('hello');
    expect(errorText()).toBe('Paste a product link from uniqlo.com.');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('another brand: says so, counts it (never the host), and remembers the host for Test mode', async () => {
    open();
    await checkLink('https://www.zara.com/us/en/tee-p0123.html');
    expect(errorText()).toBe('Choudo can read Uniqlo links for now. More brands soon.');
    expect(read<string[]>(STORAGE_KEYS.unsupportedHosts)).toEqual(['www.zara.com']);
    expect(vi.mocked(track).mock.calls).toEqual([['link-unsupported']]);
    // Listed in Test mode only.
    expect(screen.queryByTestId('unsupported-hosts')).toBeNull();
    cleanup();
    store(STORAGE_KEYS.testMode, true);
    open();
    expect(screen.getByTestId('unsupported-hosts').textContent).toBe('Unsupported hosts: www.zara.com');
  });

  it('Uniqlo outside the US', async () => {
    open();
    await checkLink('https://www.uniqlo.com/uk/en/products/E424873-000/00');
    expect(errorText()).toBe('Only Uniqlo US links for now.');
    expect(track).toHaveBeenCalledWith('link-unsupported');
  });

  it('offline: the message with Retry, and Retry tries again', async () => {
    answerWith({ chart: () => Promise.reject(new TypeError('Failed to fetch')), product: () => Promise.reject(new TypeError('Failed to fetch')) });
    open();
    await checkLink(TEE_URL);
    expect(errorText()).toContain('Couldn’t reach Uniqlo. Check your connection and try again.');
    answerWith();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result().getByRole('heading', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  });

  it('the service answering with an error status reads the same', async () => {
    answerWith({ chart: () => reply({ status: 'error', reason: 'timeout' }, 504) });
    open();
    await checkLink(TEE_URL);
    expect(errorText()).toContain('Couldn’t reach Uniqlo.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('offline with a product checked before: it still shows, from the stored copy', async () => {
    store(STORAGE_KEYS.fetched, [{ product: converted.product, fetchedAt: '2026-01-01T00:00:00.000Z' }]);
    answerWith({ chart: () => Promise.reject(new TypeError('Failed to fetch')) });
    open();
    await checkLink(TEE_URL);
    expect(result().getByRole('heading', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  });

  it('not a top', async () => {
    const pants = { ...sizeChart, result: [{ ...sizeChart.result[0]!, sizeChart: sizeChart.result[0]!.sizeChart.map((s) => ({ ...s, sizeParts: [] })) }] };
    answerWith({ chart: () => reply(pants) });
    open();
    await checkLink(TEE_URL);
    expect(errorText()).toBe('Choudo can only check tops from Uniqlo for now.');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

it('recent checks: the stored products are listed, and a click shows one again from storage', async () => {
  open();
  await checkLink(TEE_URL);
  const second = 'E000001-000';
  const secondUrls = serviceUrls(second);
  const renamed = { ...product, result: { ...product.result, productId: second, name: 'Supima Cotton T-Shirt' } };
  fetchMock = vi.fn((url: string) => (url === secondUrls.sizeChart ? reply(sizeChart) : url === secondUrls.details ? reply(renamed) : reply(product)));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await checkLink(`https://www.uniqlo.com/us/en/products/${second}`);
  expect(result().getByRole('heading', { name: 'Supima Cotton T-Shirt' })).toBeTruthy();
  fetchMock.mockClear();
  fireEvent.click(within(screen.getByTestId('check-recent')).getByRole('button', { name: 'Uniqlo Crew Neck T-Shirt' }));
  expect(result().getByRole('heading', { name: 'Crew Neck T-Shirt' })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('a stored fetched garment that fails the checks is dropped, and an outfit wearing it falls back', () => {
  const broken: StoredFetched = { product: { ...converted.product, garment: { ...converted.garment, sizes: [] } }, fetchedAt: '2026-11-26T00:00:00.000Z' };
  store(STORAGE_KEYS.fetched, [broken]);
  store(STORAGE_KEYS.outfit, { ...EMPTY_OUTFIT, topId: 'uniqlo-E424873-000', topSize: 'M' });
  open();
  fireEvent.click(screen.getByRole('button', { name: /Fitting room/ }));
  expect(screen.queryByText('From your link')).toBeNull();
  expect(screen.queryByText('Crew Neck T-Shirt')).toBeNull();
  // Storage is left as it was.
  expect(read<Outfit>(STORAGE_KEYS.outfit).topId).toBe('uniqlo-E424873-000');
});

describe('the real look: photo, drawing, colour', () => {
  it("Uniqlo's photo for the link's colour, as it is and credited; Choudo's drawing beside it in that colour; the cut in words", async () => {
    open();
    await checkLink(BLACK_URL);
    const photo = result().getByTestId('check-photo') as HTMLImageElement;
    expect(photo.getAttribute('src')).toBe('https://image.uniqlo.com/UQ/ST3/us/imagesgoods/424873/item/usgoods_09_424873_3x4.jpg');
    expect(photo.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(result().getByText('Photo: Uniqlo')).toBeTruthy();
    expect(result().getByText('On you')).toBeTruthy();
    expect(paints(result().getByTestId('check-preview'), colorHex('BLACK'))).toBe(true);
    expect(result().getByText('$14.90 · Black · Crew Neck · Short sleeve · Regular fit')).toBeTruthy();
    expect(result().getByText('Colour: Black')).toBeTruthy();
    expect(result().queryByTestId('other-sleeve')).toBeNull();
    // A button per colour, named for screen readers; the link's is pressed.
    const chips = result().getAllByRole('button', { name: /^(White|Black|Red|Brown|Green|Navy|Purple)$/ });
    expect(chips).toHaveLength(7);
    expect(result().getByRole('button', { name: 'Black' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a photo from any other host is not shown: the flat drawing is', async () => {
    const elsewhere = JSON.parse(JSON.stringify(product).replaceAll('https://image.uniqlo.com/', 'https://images.example.net/'));
    const chartElsewhere = JSON.parse(JSON.stringify(sizeChart).replaceAll('https://image.uniqlo.com/', 'https://images.example.net/'));
    answerWith({ product: () => reply(elsewhere), chart: () => reply(chartElsewhere) });
    open();
    await checkLink(BLACK_URL);
    expect(result().queryByTestId('check-photo')).toBeNull();
    expect(document.querySelector('img[src*="example.net"]')).toBeNull();
  });

  it('a colour chip recolours the drawing and the photo, and is stored with the product', async () => {
    open();
    await checkLink(BLACK_URL);
    fireEvent.click(result().getByRole('button', { name: 'White' }));
    expect(paints(result().getByTestId('check-preview'), colorHex('WHITE'))).toBe(true);
    expect(result().getByTestId('check-photo').getAttribute('src')).toBe('https://image.uniqlo.com/UQ/ST3/us/imagesgoods/424873/item/usgoods_00_424873_3x4.jpg');
    expect(read<StoredFetched[]>(STORAGE_KEYS.fetched)[0]!.product).toMatchObject({ colorCode: '00', colorName: 'WHITE', garment: { color: colorHex('WHITE') } });
  });

  it('a click on the drawing wears the chosen colour in the Fitting room', async () => {
    open();
    await checkLink(BLACK_URL);
    fireEvent.click(result().getByRole('button', { name: 'Navy' }));
    fireEvent.click(result().getByTestId('check-preview'));
    expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ topId: 'uniqlo-E424873-000', topSize: odds.recommended });
    expect(paints(screen.getByRole('region', { name: 'Mannequin' }), colorHex('NAVY'))).toBe(true);
  });

  it('a sleeve Choudo cannot draw yet is drawn short, with a note', async () => {
    const sleeveless = JSON.parse(JSON.stringify(product));
    sleeveless.result.tags = sleeveless.result.tags.map((t: { group: string }) => (t.group === 'sleeve' ? { ...t, tag: 'sleeveless', tagName: 'Sleeveless' } : t));
    answerWith({ product: () => reply(sleeveless) });
    open();
    await checkLink(TEE_URL);
    expect(result().getByTestId('other-sleeve').textContent).toBe('Choudo draws short and long sleeves only for now.');
  });
});
