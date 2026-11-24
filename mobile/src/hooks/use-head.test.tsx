import Storage from 'expo-sqlite/kv-store';
import { act, renderHook } from '@testing-library/react-native';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { useHead } from './use-head';

// usePersistentState keeps a value set during this launch, so the read comes first.

test('an unknown stored head reads as the cloud', async () => {
  Storage.setItemSync(STORAGE_KEYS.head, JSON.stringify('dragon'));
  const { result } = await renderHook(() => useHead());
  expect(result.current[0]).toBe('cloud');
});

test('a picked head is stored', async () => {
  const { result } = await renderHook(() => useHead());
  await act(() => result.current[1]('bunny'));
  expect(result.current[0]).toBe('bunny');
  expect(Storage.getItemSync(STORAGE_KEYS.head)).toBe('"bunny"');
});
