import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { catalogueFor, GARMENTS, type CatalogueScope, type Garment } from '@choudo/core/domain/garments';
import { endOfMatchingFeedText } from '@choudo/core/ui-logic/catalogueText';
import { buildFeed } from '@choudo/core/ui-logic/state/feed';
import { cachedOdds } from '@choudo/core/ui-logic/state/odds';
import { suggestedFit } from '@choudo/core/ui-logic/state/outfit';
import { STORAGE_KEYS, type Swipe } from '@choudo/core/ui-logic/state/stored';

import { useCloset } from '@/hooks/use-closet';
import { forgetThisLaunch } from '@/hooks/use-persistent-state';

import { Discover } from '.';

const BODY: BodyInput = { heightCm: 170, weightKg: 65, bodyType: 'mens' };
const model = estimateBody(BODY);
const preference = preferenceSpec(null, null);
const feedOf = (scope: CatalogueScope, swipes: Swipe[] = []) => buildFeed(catalogueFor(GARMENTS, 'mens', scope), swipes);
const swipes = (): Swipe[] => JSON.parse(Storage.getItemSync(STORAGE_KEYS.swipes) ?? '[]') as Swipe[];
const sizeOf = (g: Garment) => suggestedFit(model, g, preference).fit.sizeLabel;
const card = (g: Garment) => screen.queryByLabelText(`${g.brand} ${g.name}`);
const store = (list: Swipe[]) => Storage.setItemSync(STORAGE_KEYS.swipes, JSON.stringify(list));
const liked = (g: Garment): Swipe => ({ garmentId: g.id, sizeShown: 'M', liked: true, at: '2026-11-01T00:00:00.000Z' });

interface Handlers {
  onCatalogueChange: jest.Mock;
  onOpenDetails: jest.Mock;
  onOpenCloset: jest.Mock;
  setFeedKey: (key: number) => void;
}

/** Discover with the real closet hook (storage is the in-memory mock) and a feed key the test can bump. */
async function open(scope: CatalogueScope = 'all') {
  const handlers = { onCatalogueChange: jest.fn(), onOpenDetails: jest.fn(), onOpenCloset: jest.fn() } as unknown as Handlers;
  function Harness() {
    const closet = useCloset();
    const [feedKey, setFeedKey] = useState(0);
    handlers.setFeedKey = setFeedKey;
    return (
      <Discover
        catalogue={scope}
        onCatalogueChange={handlers.onCatalogueChange}
        model={model}
        bodyType="mens"
        preference={preference}
        closet={closet}
        feedKey={feedKey}
        onOpenDetails={handlers.onOpenDetails}
        onOpenCloset={handlers.onOpenCloset}
      />
    );
  }
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 83 } }}>
      <GestureHandlerRootView>
        <Harness />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  return handlers;
}

const press = (name: string) => act(() => fireEvent.press(screen.getByRole('button', { name })));
const settle = () => act(() => jest.advanceTimersByTime(220));

beforeEach(() => {
  jest.useFakeTimers();
  Storage.clearSync();
  forgetThisLaunch();
});
afterEach(() => jest.useRealTimers());

test('the first card is the feed’s first garment, with how many are left', async () => {
  await open();
  const feed = feedOf('all');
  expect(card(feed[0]!)).toBeTruthy();
  expect(screen.getByText(`${feed.length} to go`)).toBeTruthy();
});

test('Like records one swipe in the size shown, then the next card shows', async () => {
  await open();
  const [first, second] = feedOf('all') as [Garment, Garment];
  await press('Like');
  expect(swipes()).toMatchObject([{ garmentId: first.id, sizeShown: sizeOf(first), liked: true }]);
  await settle();
  expect(card(second)).toBeTruthy();
  expect(card(first)).toBeNull();
});

test('pressing Like twice quickly records one swipe and moves on one card', async () => {
  await open();
  const [, second, third] = feedOf('all') as [Garment, Garment, Garment];
  await press('Like');
  await press('Like');
  expect(swipes()).toHaveLength(1);
  await settle();
  expect(card(second)).toBeTruthy();
  expect(card(third)).toBeNull();
});

test('Pass records a pass', async () => {
  await open();
  const [first] = feedOf('all') as [Garment];
  await press('Pass');
  expect(swipes()).toMatchObject([{ garmentId: first.id, liked: false }]);
});

test('Fit details opens the sheet for the card in its suggested size', async () => {
  const { onOpenDetails } = await open();
  const [first] = feedOf('all') as [Garment];
  await press('Fit details');
  expect(onOpenDetails).toHaveBeenCalledWith(first, sizeOf(first));
});

describe('the end of the feed', () => {
  test('with everything liked, it says so and points to the Closet', async () => {
    const all = catalogueFor(GARMENTS, 'mens', 'all');
    store(all.map(liked));
    const { onOpenCloset } = await open('all');
    expect(screen.getByText('No more garments')).toBeTruthy();
    expect(screen.getByText('You’ve seen everything we have for now. New garments will show up here as we add them.')).toBeTruthy();
    expect(screen.queryByText(/to go$/)).toBeNull();
    await press(`See your ${all.length} liked in the Closet`);
    expect(onOpenCloset).toHaveBeenCalled();
  });

  test('on its own body type it offers Show all garments', async () => {
    store(catalogueFor(GARMENTS, 'mens', 'matching').map(liked));
    const { onCatalogueChange } = await open('matching');
    expect(screen.getByText(endOfMatchingFeedText('mens'))).toBeTruthy();
    await press('Show all garments');
    expect(onCatalogueChange).toHaveBeenCalledWith('all');
  });

  test('after passing the rest, it counts the one liked', async () => {
    const feed = feedOf('all');
    store([liked(feed[0]!)]);
    await open('all');
    for (let i = 1; i < feed.length; i++) {
      await press('Pass');
      await settle();
    }
    expect(screen.getByText('No more garments')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See your 1 liked in the Closet' })).toBeTruthy();
  });
});

test('a new feed key rebuilds the feed: liked ones gone, passed ones at the back, from the first card', async () => {
  const handlers = await open();
  const feed = feedOf('all');
  const [first, second, third] = feed as [Garment, Garment, Garment];
  await press('Like');
  await settle();
  await press('Pass');
  await settle();
  // Still the feed it opened with: the third card, two fewer to go.
  expect(card(third)).toBeTruthy();
  expect(screen.getByText(`${feed.length - 2} to go`)).toBeTruthy();
  // A fresh feed (Discover regained focus): the liked one is gone, the passed one comes back last.
  await act(() => handlers.setFeedKey(1));
  const fresh = feedOf('all', swipes());
  expect(fresh.map((g) => g.id)).not.toContain(first.id);
  expect(fresh.at(-1)!.id).toBe(second.id);
  expect(card(fresh[0]!)).toBeTruthy();
  expect(screen.getByText(`${fresh.length} to go`)).toBeTruthy();
  expect(fresh.length).toBe(feed.length - 1);
});

test('a rebuild mid fly-off that keeps the same card puts it back in the middle', async () => {
  // Everything liked but one: passing it and rebuilding leaves it first again.
  const all = catalogueFor(GARMENTS, 'mens', 'all');
  const [only, ...rest] = all as [Garment, ...Garment[]];
  store(rest.map(liked));
  const handlers = await open('all');
  await press('Pass');
  await act(() => jest.advanceTimersByTime(100));
  await act(() => handlers.setFeedKey(1));
  await settle();
  await act(() => jest.advanceTimersByTime(500));
  const shown = card(only)!;
  expect(shown).toBeTruthy();
  const style = (Reanimated.getAnimatedStyle as unknown as (c: unknown) => { transform: { translateX?: number }[] })(shown);
  expect(style.transform.find((t) => t.translateX !== undefined)!.translateX).toBe(0);
});

test('the next two cards’ odds are worked out ahead, so swiping on is instant', async () => {
  const ahead = estimateBody({ heightCm: 177, weightKg: 81, bodyType: 'mens' });
  const handlers = { onCatalogueChange: jest.fn(), onOpenDetails: jest.fn(), onOpenCloset: jest.fn() };
  function Harness() {
    const closet = useCloset();
    return <Discover catalogue="all" model={ahead} bodyType="mens" preference={preference} closet={closet} feedKey={0} {...handlers} />;
  }
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 83 } }}>
      <GestureHandlerRootView>
        <Harness />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  const [, second, third, fourth] = feedOf('all');
  expect(cachedOdds(ahead, second!, preference)).toBeUndefined();
  await act(() => jest.advanceTimersByTime(50));
  expect(cachedOdds(ahead, second!, preference)).toBeDefined();
  expect(cachedOdds(ahead, third!, preference)).toBeDefined();
  expect(cachedOdds(ahead, fourth!, preference)).toBeUndefined();
});
