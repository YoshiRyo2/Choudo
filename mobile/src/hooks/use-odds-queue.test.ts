import { act, renderHook } from '@testing-library/react-native';
import { estimateBody, type BodyModel } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';

import { useOddsQueue } from './use-odds-queue';

// Bodies no other test uses, so nothing is in the odds cache yet.
const first = estimateBody({ heightCm: 171, weightKg: 67, bodyType: 'mens' });
const second = estimateBody({ heightCm: 186, weightKg: 92, bodyType: 'mens' });
const preference = preferenceSpec(null, 'slim');
const garments = ['gildan-5000', 'gildan-18500', 'port-authority-j317'].map((id) => findGarment(id)!);
const tick = () => act(() => jest.advanceTimersToNextTimer());

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('works the odds out one garment per tick, in list order, after the first render', async () => {
  const { result } = await renderHook(() => useOddsQueue(first, preference, garments));
  expect(result.current.size).toBe(0);
  await tick();
  expect([...result.current.keys()]).toEqual(['gildan-5000']);
  expect(result.current.get('gildan-5000')).toBe(garmentOdds(first, garments[0]!, preference));
  await tick();
  await tick();
  expect([...result.current.keys()]).toEqual(garments.map((g) => g.id));
});

test('odds already worked out show at once', async () => {
  const { result } = await renderHook(() => useOddsQueue(first, preference, garments));
  // The test above filled the cache for `first`.
  expect(result.current.size).toBe(3);
});

test('a body change starts over', async () => {
  const { result, rerender } = await renderHook(({ body }: { body: BodyModel }) => useOddsQueue(body, preference, garments), { initialProps: { body: first } });
  expect(result.current.size).toBe(3);
  await rerender({ body: second });
  expect(result.current.size).toBe(0);
  await tick();
  expect(result.current.size).toBe(1);
  expect(result.current.get('gildan-5000')).toBe(garmentOdds(second, garments[0]!, preference));
});
