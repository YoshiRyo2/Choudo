import { act, renderHook } from '@testing-library/react-native';
import { estimateBody } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { cachedOdds } from '@choudo/core/ui-logic/state/odds';

import { usePrefetchOdds } from './use-prefetch-odds';

const preference = preferenceSpec(null, 'relaxed');
const garments = ['gildan-5000', 'gildan-18500'].map((id) => findGarment(id)!);
const tick = () => act(() => jest.advanceTimersToNextTimer());

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('fills the cache a garment per tick without re-rendering the screen that asked', async () => {
  const model = estimateBody({ heightCm: 181, weightKg: 77, bodyType: 'mens' });
  let renders = 0;
  await renderHook(() => {
    renders += 1;
    usePrefetchOdds(model, preference, garments);
  });
  const first = renders;
  await tick();
  expect(cachedOdds(model, garments[0]!, preference)).toBeDefined();
  expect(cachedOdds(model, garments[1]!, preference)).toBeUndefined();
  await tick();
  expect(cachedOdds(model, garments[1]!, preference)).toBeDefined();
  expect(renders).toBe(first);
});

test('paused, it works nothing out', async () => {
  const model = estimateBody({ heightCm: 182, weightKg: 78, bodyType: 'mens' });
  await renderHook(() => usePrefetchOdds(model, preference, garments, { active: false }));
  await act(() => jest.advanceTimersByTime(100));
  expect(cachedOdds(model, garments[0]!, preference)).toBeUndefined();
});
