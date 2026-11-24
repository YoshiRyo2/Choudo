import Storage from 'expo-sqlite/kv-store';
import { act, renderHook } from '@testing-library/react-native';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { useFitReference } from './use-fit-reference';

// usePersistentState keeps a value set during this launch for every later hook, so these
// tests run in order: the stored-value read comes before anything is set.

test('an invalid stored anchor reads as null', async () => {
  Storage.setItemSync(STORAGE_KEYS.anchor, JSON.stringify({ kind: 'catalogue', garmentId: 7 }));
  Storage.setItemSync(STORAGE_KEYS.fitStyle, JSON.stringify('slim'));
  const { result } = await renderHook(() => useFitReference());
  expect(result.current.anchor).toBeNull();
  expect(result.current.style).toBe('slim');
});

test('picking a style after a catalogue anchor clears the anchor', async () => {
  const { result } = await renderHook(() => useFitReference());
  await act(() => result.current.set({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' }, null));
  expect(result.current.anchor).toEqual({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' });

  await act(() => result.current.set(null, 'relaxed'));
  expect(result.current.anchor).toBeNull();
  expect(result.current.style).toBe('relaxed');
  expect(Storage.getItemSync(STORAGE_KEYS.anchor)).toBeNull();
  expect(Storage.getItemSync(STORAGE_KEYS.fitStyle)).toBe('"relaxed"');
});

test('clear() removes both keys', async () => {
  const { result } = await renderHook(() => useFitReference());
  await act(() => result.current.set({ kind: 'measured', chestFlatCm: 52, lengthCm: 72 }, 'slim'));
  expect(Storage.getItemSync(STORAGE_KEYS.anchor)).not.toBeNull();

  await act(() => result.current.clear());
  expect(result.current.anchor).toBeNull();
  expect(result.current.style).toBeNull();
  expect(Storage.getItemSync(STORAGE_KEYS.anchor)).toBeNull();
  expect(Storage.getItemSync(STORAGE_KEYS.fitStyle)).toBeNull();
});
