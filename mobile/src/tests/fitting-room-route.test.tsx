import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { catalogueFor, findGarment, GARMENTS, type Garment } from '@choudo/core/domain/garments';
import { catalogueToggle } from '@choudo/core/ui-logic/catalogueText';
import { fittingHeadline, isJustRight } from '@choudo/core/ui-logic/fitText';
import { cachedOdds, garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { defaultSize, resolveOutfit } from '@choudo/core/ui-logic/state/outfit';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Outfit } from '@choudo/core/ui-logic/state/stored';

import { byTestId, nodes, type Node } from '@/components/mannequin/svg-tree';
import { forgetThisLaunch } from '@/hooks/use-persistent-state';
import { forgetFirstLooks, setOddsLog } from '@/utils/odds-log';

const appDir = './src/app';
const MENS: BodyInput = { heightCm: 170, weightKg: 65, bodyType: 'mens' };
const WOMENS: BodyInput = { heightCm: 165, weightKg: 60, bodyType: 'womens' };
const preference = preferenceSpec(null, null);
const read = <T,>(key: string): T => JSON.parse(Storage.getItemSync(key)!) as T;
const card = (g: Garment) => screen.getByRole('button', { name: `${g.brand} ${g.name}` });

async function open(body: BodyInput = MENS, outfit?: Outfit) {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(body));
  if (outfit) Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify(outfit));
  await renderRouter(appDir, { initialUrl: '/' });
}

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
});

const model = estimateBody(MENS);
const shown = catalogueFor(GARMENTS, 'mens', 'matching');
const resolved = resolveOutfit(EMPTY_OUTFIT, model, preference, shown);

test('nothing stored yet: a top is worn, its name and the plain answer show', async () => {
  await open();
  const top = findGarment(resolved.topId!)!;
  expect(screen.getAllByText(top.name).length).toBeGreaterThan(0);
  const answer = fittingHeadline(garmentOdds(model, top, preference), resolved.topSize!, top);
  expect(screen.getByText(answer.headline)).toBeTruthy();
  expect(screen.getByText(answer.line)).toBeTruthy();
});

test('choosing another top in the carousel wears it in its default size', async () => {
  await open();
  // The card after the worn one: the list starts at the worn card (Jest draws from there on).
  const tops = shown.filter((g) => g.category === 'top');
  const i = tops.findIndex((g) => g.id === resolved.topId);
  const other = tops[i + 1] ?? tops[i - 1]!;
  await fireEvent.press(card(other));
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ topId: other.id, topSize: defaultSize(model, other, preference) });
});

test('pressing a size chip wears that size', async () => {
  await open(MENS, { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'L' });
  await fireEvent.press(screen.getByRole('radio', { name: /^M, / }));
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ topId: 'gildan-5000', topSize: 'M' });
});

test('a jacket starts in the size suggested over the top; Take off the jacket clears it', async () => {
  await open(MENS, { ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L' });
  await fireEvent.press(screen.getByText('Jacket'));
  const jacket = findGarment('port-authority-j317')!;
  await fireEvent.press(card(jacket));
  const over = garmentOdds(model, jacket, preference, { garment: findGarment('gildan-18500')!, sizeLabel: 'L' }).recommended;
  expect(over).not.toBeNull();
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ outerId: jacket.id, outerSize: over });
  await fireEvent.press(screen.getByRole('button', { name: 'Take off the jacket' }));
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ outerId: null, outerSize: null });
});

test('a stale stored outfit (a garment we no longer have, a size that is gone) still opens', async () => {
  await open(MENS, { ...EMPTY_OUTFIT, topId: 'garment-that-does-not-exist', topSize: 'XXXXL', bottomId: 'fieldline-slim-chino', bottomSize: '99' });
  expect(screen.getByRole('button', { name: 'Edit body' })).toBeTruthy();
  expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
});

test("a women's body on its own sizing has a Dress tab; a men's body has none", async () => {
  await open(WOMENS);
  expect(screen.getByText('Dress')).toBeTruthy();
  forgetThisLaunch();
  Storage.clearSync();
  await open(MENS);
  expect(screen.queryByText('Dress')).toBeNull();
  expect(screen.getByText('Jacket')).toBeTruthy();
});

test('the Show chip switches the catalogue between matching and all', async () => {
  await open();
  const matching = catalogueToggle('mens', 'matching');
  await fireEvent.press(screen.getByRole('button', { name: matching.accessibleName }));
  expect(read(STORAGE_KEYS.catalogue)).toBe('all');
  await fireEvent.press(screen.getByRole('button', { name: catalogueToggle('mens', 'all').accessibleName }));
  expect(read(STORAGE_KEYS.catalogue)).toBe('matching');
});

test('a head button wears that head', async () => {
  await open();
  const bunny = screen.getByRole('button', { name: 'Bunny head' });
  expect(bunny.props.accessibilityState).toMatchObject({ selected: false });
  await fireEvent.press(bunny);
  expect(read(STORAGE_KEYS.head)).toBe('bunny');
  expect(screen.getByRole('button', { name: 'Bunny head' }).props.accessibilityState).toMatchObject({ selected: true });
});

describe('the ちょうど stamp', () => {
  // As the web test: women's 165 cm / 70 kg in the surplice dress, where M is suggested and
  // "M fits you". (No top reaches "fits you" on the default preference.)
  const body: BodyInput = { heightCm: 165, weightKg: 70, bodyType: 'womens' };
  const dress = findGarment('landsend-surplice-dress')!;
  const odds = garmentOdds(estimateBody(body), dress, preference);
  const wearing = (size: string): Outfit => ({ ...EMPTY_OUTFIT, onepieceId: dress.id, onepieceSize: size });

  test('shows when the suggested size is worn and the headline says it fits', async () => {
    expect(odds.recommended).toBe('M');
    expect(isJustRight(odds, 'M', dress)).toBe(true);
    await open(body, wearing('M'));
    expect(screen.getByRole('image', { name: 'ちょうど: just right' })).toBeTruthy();
  });

  test("not for a size that isn't", async () => {
    expect(isJustRight(odds, 'XL', dress)).toBe(false);
    await open(body, wearing('XL'));
    expect(screen.queryByRole('image', { name: 'ちょうど: just right' })).toBeNull();
  });
});

test('the drawing may spill past its view box, so pins at the edge still show', async () => {
  await open();
  const stage = byTestId(screen.toJSON() as unknown as Node, 'stage')!;
  const svg = nodes(stage, 'RNSVGSvgView')[0]!;
  const style = Object.assign({}, ...[svg.props.style].flat(3).filter(Boolean));
  expect(style.overflow).toBe('visible');
});

test('Save outfit and See fit details open their sheets', async () => {
  await open(MENS, { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'L' });
  await fireEvent.press(screen.getByRole('button', { name: 'See fit details' }));
  expect(screen).toHavePathname('/fit-details');
  expect(screen).toHaveSearchParams({ garmentId: 'gildan-5000', size: 'L', from: 'fitting' });
});

test('Save outfit opens its sheet', async () => {
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Save outfit' }));
  expect(screen).toHavePathname('/save-outfit');
});

describe('the dev-only [odds] log (Review Focus 1: first odds on Hermes)', () => {
  const lines: { line: string; storedTop: string | null }[] = [];
  beforeEach(() => {
    lines.length = 0;
    forgetFirstLooks();
    setOddsLog((line) => lines.push({ line, storedTop: Storage.getItemSync(STORAGE_KEYS.outfit) && read<Outfit>(STORAGE_KEYS.outfit).topId }));
  });
  afterEach(() => setOddsLog(null));

  test('picking a garment times the sampling itself, not a cache hit after it', async () => {
    await open(MENS, { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'L' });
    const tops = shown.filter((g) => g.category === 'top');
    const other = tops[tops.findIndex((g) => g.id === 'gildan-5000') + 1]!;
    await fireEvent.press(card(other));
    const logged = lines.find((l) => l.line.startsWith(`[odds] ${other.id}:`));
    expect(logged).toBeDefined();
    // Timed while choosing (before the outfit was stored), where defaultSize samples it.
    expect(logged!.storedTop).toBe('gildan-5000');
  });

  test("a first launch times the outfit's default sizes", async () => {
    await open();
    expect(lines.some((l) => /^\[odds\] outfit defaults: \d+ ms$/.test(l.line))).toBe(true);
  });

  test('a worn jacket is not re-sampled while the top changes on the Top tab', async () => {
    await open(MENS, { ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', outerId: 'port-authority-j317', outerSize: 'L' });
    await fireEvent.press(screen.getByRole('radio', { name: /^M, / }));
    expect(read<Outfit>(STORAGE_KEYS.outfit).topSize).toBe('M');
    expect(lines.filter((l) => l.line.includes('port-authority-j317'))).toEqual([]);
  });
});

describe("the open tab's neighbours are worked out ahead (instant swiping)", () => {
  // A body no other test uses: nothing in the odds cache yet.
  const BODY: BodyInput = { heightCm: 168, weightKg: 63, bodyType: 'mens' };
  const fresh = estimateBody(BODY);
  const tops = catalogueFor(GARMENTS, 'mens', 'matching').filter((g) => g.category === 'top');
  const k = 2;
  const ahead = () => act(() => jest.advanceTimersByTime(50));

  test('the garments either side of the worn one, and no others', async () => {
    await open(BODY, { ...EMPTY_OUTFIT, topId: tops[k]!.id, topSize: 'M' });
    expect(cachedOdds(fresh, tops[k - 1]!, preference)).toBeUndefined();
    await ahead();
    expect(cachedOdds(fresh, tops[k - 1]!, preference)).toBeDefined();
    expect(cachedOdds(fresh, tops[k + 1]!, preference)).toBeDefined();
    expect(cachedOdds(fresh, tops[k - 2]!, preference)).toBeUndefined();
    expect(cachedOdds(fresh, tops[k + 2]!, preference)).toBeUndefined();
  });

  test("switching tabs drops the old tab's neighbours", async () => {
    const other: BodyInput = { heightCm: 169, weightKg: 64, bodyType: 'mens' };
    const model2 = estimateBody(other);
    await open(other, { ...EMPTY_OUTFIT, topId: tops[k]!.id, topSize: 'M' });
    await act(() => fireEvent.press(screen.getByText('Bottom')));
    await ahead();
    expect(cachedOdds(model2, tops[k - 1]!, preference)).toBeUndefined();
    expect(cachedOdds(model2, tops[k + 1]!, preference)).toBeUndefined();
  });

  test('on the Jacket tab, the neighbours are worked out over the top under them', async () => {
    const other: BodyInput = { heightCm: 167, weightKg: 62, bodyType: 'mens' };
    const model3 = estimateBody(other);
    // All garments, so both soft shells are in the carousel: the worn one and the next.
    const jackets = catalogueFor(GARMENTS, 'mens', 'all').filter((g) => g.category === 'outer');
    expect(jackets.length).toBeGreaterThan(1);
    Storage.setItemSync(STORAGE_KEYS.catalogue, JSON.stringify('all'));
    await open(other, { ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', outerId: jackets[0]!.id, outerSize: 'L' });
    await act(() => fireEvent.press(screen.getByText('Jacket')));
    await ahead();
    const under = { garment: findGarment('gildan-18500')!, sizeLabel: 'L' };
    expect(cachedOdds(model3, jackets[1]!, preference, under)).toBeDefined();
  });
});
