import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderHook, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { catalogueFor, GARMENTS, type Garment } from '@choudo/core/domain/garments';
import { buildFeed } from '@choudo/core/ui-logic/state/feed';
import { suggestedFit } from '@choudo/core/ui-logic/state/outfit';
import { STORAGE_KEYS, type Outfit, type Swipe } from '@choudo/core/ui-logic/state/stored';

import { useCloset } from '@/hooks/use-closet';
import { forgetThisLaunch } from '@/hooks/use-persistent-state';

const appDir = './src/app';
const BODY: BodyInput = { heightCm: 170, weightKg: 65, bodyType: 'mens' };
const matching = catalogueFor(GARMENTS, 'mens', 'matching');
const read = <T,>(key: string): T => JSON.parse(Storage.getItemSync(key)!) as T;
const card = (g: Garment) => screen.queryByLabelText(`${g.brand} ${g.name}`);
const press = (name: string) => act(() => fireEvent.press(screen.getByRole('button', { name })));
/** The card's fly-off (220 ms): renderRouter runs on Jest's fake timers. */
const flyOff = () => act(() => jest.advanceTimersByTime(220));

async function open(swipes: Swipe[] = []) {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(BODY));
  if (swipes.length) Storage.setItemSync(STORAGE_KEYS.swipes, JSON.stringify(swipes));
  await renderRouter(appDir, { initialUrl: '/discover' });
}

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
});

test('unliking elsewhere brings the garment back when Discover is opened again', async () => {
  // Until the Closet tab is built (PR 7), unlike the way it will: through useCloset. Mounted
  // first, so `screen` stays the app.
  const closet = await renderHook(() => useCloset());
  await open();
  const feed = buildFeed(matching, []);
  const first = feed[0]!;
  expect(screen.getByText(`${feed.length} to go`)).toBeTruthy();
  await press('Like');
  await flyOff();
  expect(screen.getByText(`${feed.length - 1} to go`)).toBeTruthy();

  await act(() => router.navigate('/closet'));
  await act(() => closet.result.current.unlike(first.id));
  await act(() => router.navigate('/discover'));

  // A fresh feed: the unliked garment is back (passed, so at the end), the count is whole again.
  expect(screen.getByText(`${feed.length} to go`)).toBeTruthy();
});

test('Fit details from a card, then "Try M in the fitting room", wears it in M on the Fitting room', async () => {
  await open();
  const first = buildFeed(matching, [])[0]!;
  expect(first.sizes.some((s) => s.label === 'M')).toBe(true);
  await press('Fit details');
  expect(screen).toHavePathname('/fit-details');
  const size = suggestedFit(estimateBody(BODY), first, preferenceSpec(null, null)).fit.sizeLabel;
  expect(screen).toHaveSearchParams({ garmentId: first.id, size, from: 'browse' });
  await act(() => fireEvent.press(screen.getByRole('radio', { name: /^M, / })));
  await press('Try M in the fitting room');
  expect(screen).toHavePathname('/');
  const slot = first.category === 'onepiece' ? 'onepiece' : first.category;
  expect(read<Outfit>(STORAGE_KEYS.outfit)).toMatchObject({ [`${slot}Id`]: first.id, [`${slot}Size`]: 'M' });
  // The Fitting room shows it (the radio for M is the one checked).
  expect(screen.getAllByText(first.name).length).toBeGreaterThan(0);
  expect(screen.getByRole('radio', { name: /^M, / }).props.accessibilityState).toMatchObject({ checked: true });
});

test('Show all garments at the end of the matching feed stores the scope and starts a new feed', async () => {
  const at = '2026-11-01T00:00:00.000Z';
  await open(matching.map((g) => ({ garmentId: g.id, sizeShown: 'M', liked: true, at })));
  expect(screen.getByText('No more garments')).toBeTruthy();
  await press('Show all garments');
  expect(read(STORAGE_KEYS.catalogue)).toBe('all');
  const rest = catalogueFor(GARMENTS, 'mens', 'all').filter((g) => !matching.includes(g));
  expect(rest.length).toBeGreaterThan(0);
  expect(card(rest[0]!)).toBeTruthy();
  expect(screen.getByText(`${rest.length} to go`)).toBeTruthy();
});

