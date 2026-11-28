// @vitest-environment jsdom
// The Check tab with a Zara link, end to end through App (Uniqlo's are in App.check.test.tsx).
import './ui/test/dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { fitAllSizes, preferenceSpec } from '@choudo/core/domain/fit';
import { templateOf } from '@choudo/core/domain/garments';
import { parseProductLink, readyFetchedGarment, zaraToSeedGarment, type ZaraLink } from '@choudo/core/domain/links';
import guide from '@choudo/core/domain/links/__fixtures__/zara-guide-616513993.json';
import missingGuide from '@choudo/core/domain/links/__fixtures__/zara-guide-missing.json';
import search from '@choudo/core/domain/links/__fixtures__/zara-search-04174639.json';
import noMatch from '@choudo/core/domain/links/__fixtures__/zara-search-no-match.json';
import { fittingHeadline, reliabilityText, whyLine } from '@choudo/core/ui-logic/fitText';
import { reliability } from '@choudo/core/ui-logic/reliability';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { STORAGE_KEYS, type Outfit, type StoredFetched } from '@choudo/core/ui-logic/state/stored';
import { App } from './App';
import { zaraServiceUrls } from './links/fetchZara';
import { track } from './ui/analytics';

vi.mock('./ui/analytics', async (original) => ({ ...(await original<typeof import('./ui/analytics')>()), track: vi.fn() }));

const NAVY_URL = 'https://www.zara.com/us/en/interlock-long-sleeve-t-shirt-p04174639.html?v1=616513993';
const NAVY_PHOTO =
  'https://static.zara.net/assets/public/dbac/ddca/22954b569097/d4c2aec298bf/04174639401-p/04174639401-p.jpg?ts=1795509515737&w=750';
const BLACK_PHOTO =
  'https://static.zara.net/assets/public/0f3a/6dc2/0b8149efa359/b325e50d501b/04174639800-p/04174639800-p.jpg?ts=1795509507255&w=750';
const WOMENS: BodyInput = { heightCm: 163, weightKg: 56, bodyType: 'womens' };
const model = estimateBody(WOMENS);
const preference = preferenceSpec(null, null);
const SEARCH = zaraServiceUrls.search('04174639');
const read = <T,>(key: string): T => JSON.parse(localStorage.getItem(key)!) as T;
const store = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const converted = zaraToSeedGarment(search, guide, parseProductLink(NAVY_URL) as ZaraLink, '2026-11-28');
if (!converted.ok) throw new Error(converted.reason);
const tee = readyFetchedGarment(converted.garment)!;
const odds = garmentOdds(model, tee, preference);
const fits = fitAllSizes(model, tee);

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);
let fetchMock: Mock;

/** The fetch service: the search for 04174639, and a size guide for any colour id. */
function answerWith(by: { search?: () => Promise<Response>; guide?: () => Promise<Response> } = {}) {
  fetchMock = vi.fn((url: string) => {
    if (url === SEARCH) return by.search ? by.search() : reply(search);
    if (url.endsWith('/size-guide')) return by.guide ? by.guide() : reply(guide);
    if (url.endsWith('/search')) return reply(noMatch);
    return Promise.reject(new TypeError(`unexpected ${url}`));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

function open() {
  store(STORAGE_KEYS.body, WOMENS);
  render(<App />);
}

const field = () => screen.getByRole('textbox', { name: 'Paste a Uniqlo or Zara link' }) as HTMLInputElement;
async function checkLink(text: string) {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Check size' }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const result = () => within(screen.getByTestId('check-result'));
const errorText = () => screen.getByTestId('check-error').textContent;
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

it('a Zara link: reading Zara’s chart, then the product, the answer, the why-line and the confidence line', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  answerWith({ search: () => gate.then(() => reply(search)) });
  open();
  fireEvent.change(field(), { target: { value: `Is this my size? ${NAVY_URL}` } });
  fireEvent.click(screen.getByRole('button', { name: 'Check size' }));
  expect(screen.getByTestId('check-loading').textContent).toBe('Reading Zara’s size chart…');
  await act(async () => {
    release();
    await new Promise((r) => setTimeout(r, 0));
  });
  // The search, then the guide for the link's colour, both to the fetch service: nothing about the body.
  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([SEARCH, zaraServiceUrls.sizeGuide(616513993)]);
  expect(result().getByText('Zara')).toBeTruthy();
  expect(result().getByRole('heading', { name: 'Interlock Long-Sleeve T-Shirt' })).toBeTruthy();
  const size = odds.recommended!;
  const fit = fits.find((f) => f.sizeLabel === size)!;
  const card = screen.getByTestId('check-result');
  expect(card.querySelector('.fit-answer__headline')?.textContent).toBe(fittingHeadline(odds, size, tee).headline);
  expect(card.querySelector('.fit-answer__why')?.textContent).toBe(whyLine(fits, size, templateOf(tee), 'metric', fit.bodyType));
  expect(card.querySelector('.fit-answer__trust')?.textContent).toContain(reliabilityText(reliability(fit, tee, { hasFitReference: false }), fit.bodyType));
  expect(read<StoredFetched[]>(STORAGE_KEYS.fetched)[0]!.product.garment.id).toBe('zara-04174639');
  expect(track).toHaveBeenCalledWith('link-checked');
});

it("Zara's photo for the link's colour, as it is and credited; the drawing in Zara's colour; four colour chips", async () => {
  open();
  await checkLink(NAVY_URL);
  const photo = result().getByTestId('check-photo') as HTMLImageElement;
  expect(photo.getAttribute('src')).toBe(NAVY_PHOTO);
  expect(photo.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(result().getByText('Photo: Zara')).toBeTruthy();
  expect(paints(result().getByTestId('check-preview'), '#252731')).toBe(true);
  expect(result().getByText('$17.94 · Navy Blue · Long sleeve')).toBeTruthy();
  expect(result().getAllByRole('button', { name: /^(Navy Blue|Green|Ecru|Black)$/ })).toHaveLength(4);
  expect(result().getByRole('button', { name: 'Navy Blue' }).getAttribute('aria-pressed')).toBe('true');
});

it('a colour chip switches the photo and the drawing, and is stored with the product', async () => {
  open();
  await checkLink(NAVY_URL);
  fireEvent.click(result().getByRole('button', { name: 'Black' }));
  expect(result().getByTestId('check-photo').getAttribute('src')).toBe(BLACK_PHOTO);
  expect(paints(result().getByTestId('check-preview'), '#121315')).toBe(true);
  expect(read<StoredFetched[]>(STORAGE_KEYS.fetched)[0]!.product).toMatchObject({ colorCode: '800', colorName: 'Black', garment: { color: '#121315' } });
});

it('Try it on wears it in the Fitting room, tagged as from the link, once', async () => {
  open();
  await checkLink(NAVY_URL);
  fireEvent.click(result().getByRole('button', { name: 'Try it on' }));
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ topId: 'zara-04174639', topSize: odds.recommended });
  const tops = within(screen.getByRole('list', { name: 'Tops' }));
  expect(tops.getAllByText('Interlock Long-Sleeve T-Shirt')).toHaveLength(1);
  expect(tops.getAllByText('From your link')).toHaveLength(1);
  expect(paints(screen.getByRole('region', { name: 'Mannequin' }), '#252731')).toBe(true);
});

it('Open at Zara is a link to the product page, in a new tab with no opener or referrer', async () => {
  open();
  await checkLink(NAVY_URL);
  const linkEl = result().getByRole('link', { name: 'Open at Zara' });
  expect(linkEl.getAttribute('href')).toBe(NAVY_URL);
  expect(linkEl.getAttribute('target')).toBe('_blank');
  expect(linkEl.getAttribute('rel')).toBe('noopener noreferrer');
});

it('a photo from any other host is not shown', async () => {
  answerWith({ search: () => reply(JSON.parse(JSON.stringify(search).replaceAll('https://static.zara.net/', 'https://images.example.net/'))) });
  open();
  await checkLink(NAVY_URL);
  expect(result().queryByTestId('check-photo')).toBeNull();
  expect(document.querySelector('img[src*="example.net"]')).toBeNull();
});

describe('errors', () => {
  it('no product with that number', async () => {
    open();
    await checkLink('https://www.zara.com/us/en/-p99999998.html');
    expect(errorText()).toBe('Zara has no product at this link. Paste another product link.');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([zaraServiceUrls.search('99999998')]);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('a product without a size guide (Zara’s 404)', async () => {
    answerWith({ guide: () => reply(missingGuide, 404) });
    open();
    await checkLink(NAVY_URL);
    expect(errorText()).toBe('Zara doesn’t list garment measurements for this product. Try another one.');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('not a top', async () => {
    answerWith({ search: () => reply(JSON.parse(JSON.stringify(search).replaceAll('"T-SHIRT"', '"BLAZER"'))) });
    open();
    await checkLink(NAVY_URL);
    expect(errorText()).toBe('Choudo can only check tops from Zara for now.');
  });

  it('Zara outside the US', async () => {
    open();
    await checkLink('https://www.zara.com/es/en/-p04174639.html');
    expect(errorText()).toBe('Only Zara US links for now.');
    expect(track).toHaveBeenCalledWith('link-unsupported');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a zara.com page that is not a product', async () => {
    open();
    await checkLink('https://www.zara.com/us/en/woman-tshirts-l1362.html');
    expect(errorText()).toBe('Paste a product link from zara.com.');
  });

  it('blocked or offline: the message with Retry', async () => {
    answerWith({ search: () => reply('<html>Access Denied</html>', 403) });
    open();
    await checkLink(NAVY_URL);
    expect(errorText()).toContain('Couldn’t reach Zara. Check your connection and try again.');
    answerWith();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result().getByRole('heading', { name: 'Interlock Long-Sleeve T-Shirt' })).toBeTruthy();
  });
});
