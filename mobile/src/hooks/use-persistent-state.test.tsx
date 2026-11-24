import Storage from 'expo-sqlite/kv-store';
import { act, renderHook } from '@testing-library/react-native';

import { usePersistentState } from './use-persistent-state';

const isNumberOrNull = (v: unknown): v is number | null => v === null || typeof v === 'number';

beforeEach(() => {
  Storage.clearSync();
});

test('starts from a valid stored value', async () => {
  Storage.setItemSync('k', '3');
  const { result } = await renderHook(() => usePersistentState('k', 7, isNumberOrNull));
  expect(result.current[0]).toBe(3);
});

test('ignores a stored value that fails the guard', async () => {
  Storage.setItemSync('k', '"three"');
  const { result } = await renderHook(() => usePersistentState('k', 7, isNumberOrNull));
  expect(result.current[0]).toBe(7);
});

test('the setter updates the state and stores JSON', async () => {
  const { result } = await renderHook(() => usePersistentState<number | null>('k', 7, isNumberOrNull));
  await act(() => result.current[1](5));
  expect(result.current[0]).toBe(5);
  expect(Storage.getItemSync('k')).toBe('5');
});

test('setting null removes the key', async () => {
  Storage.setItemSync('k', '3');
  const { result } = await renderHook(() => usePersistentState<number | null>('k', 7, isNumberOrNull));
  await act(() => result.current[1](null));
  expect(result.current[0]).toBeNull();
  expect(Storage.getItemSync('k')).toBeNull();
});
