import { renderHook } from '@testing-library/react-native';
import { stampLedger } from '@choudo/core/ui-logic/state/stampSeen';

import { useStampDrop } from './use-stamp-drop';

/** A fresh ledger per test, in memory, as on the phone. */
const freshClaim = () => {
  const ledger = stampLedger(null);
  return (key: string) => ledger.claim(key);
};

test('drops on the first render with a key the claim accepts', async () => {
  const claim = freshClaim();
  const { result } = await renderHook(() => useStampDrop('gildan-5000|M', claim));
  expect(result.current).toBe(true);
});

test('a key already claimed is simply there, no drop', async () => {
  const claim = freshClaim();
  claim('gildan-5000|M');
  const { result } = await renderHook(() => useStampDrop('gildan-5000|M', claim));
  expect(result.current).toBe(false);
});

test('no stamp, no drop', async () => {
  const { result } = await renderHook(() => useStampDrop(null, freshClaim()));
  expect(result.current).toBe(false);
});

test('a new key drops again; an old one coming back does not', async () => {
  const claim = freshClaim();
  const { result, rerender } = await renderHook(({ key }: { key: string | null }) => useStampDrop(key, claim), {
    initialProps: { key: 'gildan-5000|M' as string | null },
  });
  expect(result.current).toBe(true);
  await rerender({ key: 'gildan-5000|L' });
  expect(result.current).toBe(true);
  await rerender({ key: null });
  expect(result.current).toBe(false);
  await rerender({ key: 'gildan-5000|M' });
  expect(result.current).toBe(false);
});
