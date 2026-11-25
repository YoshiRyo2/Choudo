import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  GestureHandlerRootView,
  State,
  type LegacyPanGesture as PanGesture,
  type LegacyTapGesture as TapGesture,
} from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';
import { estimateBody } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { tilt, type SwipeOutcome } from '@choudo/core/ui-logic/components/SwipeCard/swipe';
import { sizeLine, verdictLine } from '@choudo/core/ui-logic/fitText';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { suggestedFit } from '@choudo/core/ui-logic/state/outfit';

import { decideDrag, leanFor, SwipeCard } from './swipe-card';

test('a drag past a third of the card decides; short and slow snaps back', () => {
  expect(decideDrag(100, 0, 320)).toBe('like');
  expect(decideDrag(-100, 0, 320)).toBe('pass');
  expect(decideDrag(90, 100, 320)).toBeNull();
});

test('a quick flick past 30 pt decides, but not one against the drag', () => {
  // Gesture Handler gives px per second; swipe.ts wants px per ms.
  expect(decideDrag(40, 600, 320)).toBe('like');
  expect(decideDrag(40, -600, 320)).toBeNull();
});

test("the card's lean while dragged is swipe.ts's tilt", () => {
  for (const dx of [-500, -320, -100, -1, 0, 3, 96, 200, 320, 900]) expect(leanFor(dx, 320)).toBe(tilt(dx, 320));
  expect(leanFor(50, 0)).toBe(tilt(50, 0));
});

const model = estimateBody({ heightCm: 170, weightKg: 65, bodyType: 'mens' });
const preference = preferenceSpec(null, null);
const tee = findGarment('gildan-5000')!;
const suggested = suggestedFit(model, tee, preference);
const verdict = verdictLine(garmentOdds(model, tee, preference), suggested.fit.sizeLabel, tee);

const element = (leaving: SwipeOutcome, interactive: boolean, onDecide: jest.Mock, onOpen: jest.Mock) => (
  <GestureHandlerRootView>
    <SwipeCard
      garment={tee}
      body={model.measurements}
      fit={suggested.fit}
      recommended={suggested.recommended}
      verdict={verdict}
      leaving={leaving}
      interactive={interactive}
      onDecide={onDecide}
      onOpen={onOpen}
    />
  </GestureHandlerRootView>
);

async function show(props: { interactive?: boolean } = {}) {
  const onDecide = jest.fn();
  const onOpen = jest.fn();
  const interactive = props.interactive ?? true;
  await render(element(null, interactive, onDecide, onOpen));
  const leave = (leaving: SwipeOutcome) => screen.rerender(element(leaving, interactive, onDecide, onOpen));
  return { onDecide, onOpen, leave, card: screen.getByLabelText(`${tee.brand} ${tee.name}`) };
}

type Drawn = { transform: ({ translateX?: number; rotate?: string })[] };
/** Reanimated's test helper (typed from its web stub, so cast). */
const drawn = (el: unknown) => (Reanimated.getAnimatedStyle as unknown as (c: unknown) => Drawn)(el);
const rotation = (el: unknown) => parseFloat(drawn(el).transform.find((t) => t.rotate)!.rotate!);

test('the card shows the brand, name, size line and verdict', async () => {
  await show();
  expect(screen.getByText(tee.brand)).toBeTruthy();
  expect(screen.getByText(tee.name)).toBeTruthy();
  expect(screen.getByText(sizeLine(suggested.fit.sizeLabel, suggested.recommended))).toBeTruthy();
  expect(screen.getByText(verdict.headline)).toBeTruthy();
});

test('VoiceOver reads the size line and the verdict after the name', async () => {
  const { card } = await show();
  expect(card.props.accessibilityValue).toEqual({ text: `${sizeLine(suggested.fit.sizeLabel, suggested.recommended)}. ${verdict.headline}` });
});

test('flying off, the card leans over as it goes, not in one jump', async () => {
  jest.useFakeTimers();
  try {
    const { leave, card } = await show();
    await act(() => leave('like'));
    await act(() => jest.advanceTimersByTime(60));
    const lean = rotation(card);
    expect(lean).toBeGreaterThan(0);
    expect(lean).toBeLessThan(14);
    await act(() => jest.advanceTimersByTime(400));
    expect(rotation(card)).toBeCloseTo(14);
  } finally {
    jest.useRealTimers();
  }
});

test('VoiceOver can like, pass or open Fit details from the card', async () => {
  const { onDecide, onOpen, card } = await show();
  expect(card.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual(['Like', 'Pass', 'Fit details']);
  await act(() =>
    fireEvent(card, 'accessibilityAction', {
      nativeEvent: { actionName: 'like' },
    }),
  );
  await act(() =>
    fireEvent(card, 'accessibilityAction', {
      nativeEvent: { actionName: 'pass' },
    }),
  );
  await act(() =>
    fireEvent(card, 'accessibilityAction', {
      nativeEvent: { actionName: 'details' },
    }),
  );
  expect(onDecide.mock.calls).toEqual([['like'], ['pass']]);
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('a card that is not interactive ignores the actions', async () => {
  const { onDecide, onOpen, card } = await show({ interactive: false });
  await act(() =>
    fireEvent(card, 'accessibilityAction', {
      nativeEvent: { actionName: 'like' },
    }),
  );
  await act(() =>
    fireEvent(card, 'accessibilityAction', {
      nativeEvent: { actionName: 'details' },
    }),
  );
  expect(onDecide).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
});

describe('dragging the card', () => {
  const drag = (translationX: number, velocityX: number) =>
    fireGestureHandler<PanGesture>(getByGestureTestId('swipe-pan'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: translationX / 2 },
      { state: State.ACTIVE, translationX },
      { state: State.END, translationX, velocityX },
    ]);

  test('past the decide distance it likes', async () => {
    const { onDecide } = await show();
    await act(async () => drag(200, 0));
    expect(onDecide).toHaveBeenCalledWith('like');
  });

  test('a slow drag short of it records nothing', async () => {
    const { onDecide, onOpen } = await show();
    await act(async () => drag(-40, -50));
    expect(onDecide).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('a drag the system cancels (a call, Control Centre) decides nothing', async () => {
    const { onDecide } = await show();
    await act(async () =>
      fireGestureHandler<PanGesture>(getByGestureTestId('swipe-pan'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 200 },
        { state: State.CANCELLED, translationX: 200 },
      ]),
    );
    expect(onDecide).not.toHaveBeenCalled();
  });

  test('a tap opens Fit details', async () => {
    const { onOpen } = await show();
    await act(async () =>
      fireGestureHandler<TapGesture>(getByGestureTestId('swipe-tap'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

test('a still press of any length, released within 6 pt, opens Fit details (as the web)', async () => {
  await show();
  const tap = getByGestureTestId('swipe-tap') as unknown as { config: { maxDurationMs?: number; maxDist?: number } };
  // Gesture Handler's tap gives up after 500 ms unless told otherwise: a minute is "any length".
  expect(tap.config.maxDurationMs).toBeGreaterThanOrEqual(60_000);
});
