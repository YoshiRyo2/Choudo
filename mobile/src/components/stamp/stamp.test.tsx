import { act, render, screen } from '@testing-library/react-native';

import * as Reanimated from 'react-native-reanimated';
import { stampLedger } from '@choudo/core/ui-logic/state/stampSeen';

import { Stamp } from './index';
import { useStampDrop } from './use-stamp-drop';

type Drawn = { opacity: number; transform: { scale?: number }[] };
/** Reanimated's test helper (typed from its web stub, so cast). */
const drawn = (el: unknown) => (Reanimated.getAnimatedStyle as unknown as (c: unknown) => Drawn)(el);

afterEach(() => jest.useRealTimers());

test('the seal is named for VoiceOver', async () => {
  await render(<Stamp dropping={false} />);
  expect(screen.getByRole('image', { name: 'ちょうど: just right' })).toBeTruthy();
});

test('onLanded fires as the drop touches down (55 % of 260 ms), once', async () => {
  jest.useFakeTimers();
  const onLanded = jest.fn();
  await render(<Stamp dropping onLanded={onLanded} />);
  await act(() => jest.advanceTimersByTime(140));
  expect(onLanded).not.toHaveBeenCalled();
  await act(() => jest.advanceTimersByTime(10));
  expect(onLanded).toHaveBeenCalledTimes(1);
  await act(() => jest.advanceTimersByTime(1000));
  expect(onLanded).toHaveBeenCalledTimes(1);
});

test('a stamp already seen is simply there, at full ink: no landing', async () => {
  jest.useFakeTimers();
  const onLanded = jest.fn();
  await render(<Stamp dropping={false} onLanded={onLanded} />);
  await act(() => jest.advanceTimersByTime(20));
  const style = drawn(screen.getByRole('image'));
  expect(style.opacity).toBe(1);
  expect(style.transform.find((t) => t.scale !== undefined)!.scale).toBe(1);
  await act(() => jest.advanceTimersByTime(1000));
  expect(onLanded).not.toHaveBeenCalled();
});

describe('the real flow: a stamp mounts, then useStampDrop says it drops', () => {
  // As the Stage does: the Stamp is keyed by its stamp and mounts before the claim (a layout
  // effect) turns `dropping` true on the next render.
  function Flow({ stampKey, claim }: { stampKey: string; claim: (key: string) => boolean }) {
    const dropping = useStampDrop(stampKey, claim);
    return <Stamp key={stampKey} dropping={dropping} />;
  }
  const seal = () => screen.getByRole('image', { name: 'ちょうど: just right' });

  test('it starts unseen and 1.5× big, then lands at full ink', async () => {
    jest.useFakeTimers();
    const ledger = stampLedger(null);
    await render(<Flow stampKey="gildan-5000|M" claim={(k) => ledger.claim(k)} />);
    // 50 ms in: still fading in, and still coming down from 1.5×.
    await act(() => jest.advanceTimersByTime(50));
    const early = drawn(seal());
    expect(early.opacity).toBeLessThan(0.9);
    expect(early.transform.find((t) => t.scale !== undefined)!.scale).toBeGreaterThan(1.1);
    await act(() => jest.advanceTimersByTime(400));
    const end = drawn(seal());
    expect(end.opacity).toBe(1);
    expect(end.transform.find((t) => t.scale !== undefined)!.scale).toBeCloseTo(1);
  });
});
