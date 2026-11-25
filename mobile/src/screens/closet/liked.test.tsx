import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { estimateBody, type BodyModel } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { findGarment, GARMENTS, publicGarments, type Garment } from '@choudo/core/domain/garments';
import { sizeLine, verdictLine } from '@choudo/core/ui-logic/fitText';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { defaultSize, middleSize } from '@choudo/core/ui-logic/state/outfit';

import { Liked } from './liked';

const preference = preferenceSpec(null, null);
const top = findGarment('gildan-5000')!;
const bottom = findGarment('fieldline-slim-chino')!;
const jacket = findGarment('port-authority-j317')!;
// Newest first, as likedIds gives them; one garment that has left the catalogue.
const LIKED = [jacket.id, 'garment-that-is-gone', bottom.id, top.id];

async function show(
  likedIds: string[],
  model: BodyModel = estimateBody({ heightCm: 170, weightKg: 65, bodyType: 'mens' }),
  garments: readonly Garment[] = GARMENTS,
) {
  const props = { onOpen: jest.fn(), onUnlike: jest.fn(), onFolders: jest.fn(), onOpenDiscover: jest.fn() };
  await render(<Liked model={model} preference={preference} garments={garments} likedIds={likedIds} folderCount={() => 0} {...props} />);
  return props;
}
const tiles = () => screen.getAllByTestId(/^garment-tile-/).map((t) => t.props.accessibilityLabel);

test('nothing liked yet: the empty state sends you to Discover', async () => {
  const { onOpenDiscover } = await show([]);
  expect(screen.getByText('Nothing liked yet')).toBeTruthy();
  expect(screen.getByText('Tap the heart in Discover, or swipe right, to keep a garment here.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Go to Discover' }));
  expect(onOpenDiscover).toHaveBeenCalled();
});

test('liked garments newest first; one no longer in the catalogue is skipped', async () => {
  await show(LIKED);
  expect(tiles()).toEqual([jacket, bottom, top].map((g) => `${g.brand} ${g.name}`));
  expect(screen.getByText('All 3')).toBeTruthy();
});

test('the filters show one category, or say there are none', async () => {
  await show(LIKED);
  await fireEvent.press(screen.getByText('Bottoms'));
  expect(tiles()).toEqual([`${bottom.brand} ${bottom.name}`]);
  await fireEvent.press(screen.getByText('Dresses'));
  expect(screen.getByText('No liked dresses yet.')).toBeTruthy();
});

test('a store build: a liked sample (Fieldline) is skipped, the real ones stay', async () => {
  await show(LIKED, undefined, publicGarments(GARMENTS, { includeSamples: false }));
  expect(tiles()).toEqual([jacket, top].map((g) => `${g.brand} ${g.name}`));
  expect(screen.getByText('All 2')).toBeTruthy();
});

test('only samples liked: in a store build it is the empty state', async () => {
  await show([bottom.id], undefined, publicGarments(GARMENTS, { includeSamples: false }));
  expect(screen.getByText('Nothing liked yet')).toBeTruthy();
});

test('a category with no garments at all gets no filter', async () => {
  await show(LIKED, undefined, GARMENTS.filter((g) => g.category !== 'onepiece'));
  expect(screen.getByText('Bottoms')).toBeTruthy();
  expect(screen.queryByText('Dresses')).toBeNull();
});

test('the heart unlikes; Add to folder opens the picker', async () => {
  const { onUnlike, onFolders } = await show(LIKED);
  await fireEvent.press(screen.getByRole('button', { name: `Unlike ${top.brand} ${top.name}` }));
  expect(onUnlike).toHaveBeenCalledWith(top.id);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Add to folder' })[0]!);
  expect(onFolders).toHaveBeenCalledWith(jacket);
});

describe('tiles fill in one at a time', () => {
  // A body no other test uses: nothing cached.
  const model = estimateBody({ heightCm: 173, weightKg: 71, bodyType: 'mens' });
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a skeleton until its odds are in, then the size line and verdict', async () => {
    await show([top.id, bottom.id], model);
    expect(screen.getAllByTestId('tile-skeleton')).toHaveLength(2);
    await act(() => jest.advanceTimersToNextTimer());
    expect(screen.getAllByTestId('tile-skeleton')).toHaveLength(1);
    const odds = garmentOdds(model, top, preference);
    const size = odds.recommended ?? middleSize(top);
    expect(screen.getByText(sizeLine(size, odds.recommended !== null))).toBeTruthy();
    expect(screen.getAllByText(verdictLine(odds, size, top).headline).length).toBeGreaterThan(0);
    await act(() => jest.advanceTimersToNextTimer());
    expect(screen.queryAllByTestId('tile-skeleton')).toHaveLength(0);
  });

  test('tapping a tile before its odds are in opens it in its default size', async () => {
    const fresh = estimateBody({ heightCm: 166, weightKg: 61, bodyType: 'mens' });
    const { onOpen } = await show([bottom.id], fresh);
    expect(screen.getAllByTestId('tile-skeleton')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: `${bottom.brand} ${bottom.name}` }));
    expect(onOpen).toHaveBeenCalledWith(bottom, defaultSize(fresh, bottom, preference));
  });
});
