import Storage from 'expo-sqlite/kv-store';
import { act, renderHook } from '@testing-library/react-native';
import { nextOutfitName } from '@choudo/core/ui-logic/state/closet';
import { EMPTY_OUTFIT, STORAGE_KEYS, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { useCatalogue } from './use-catalogue';
import { useCloset } from './use-closet';
import { useOutfit } from './use-outfit';
import { usePreference } from './use-preference';

// usePersistentState keeps a value set during this launch for every later hook, so these
// tests run in order and build on each other.

const outfit = { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'L' };
const stored = <T,>(key: string): T => JSON.parse(Storage.getItemSync(key)!) as T;

test('saveOutfit with a blank name stores one outfit under the next default name', async () => {
  const { result } = await renderHook(() => useCloset());
  await act(() => result.current.saveOutfit(outfit, '  '));
  expect(result.current.outfits).toHaveLength(1);
  expect(result.current.outfits[0]!.name).toBe(nextOutfitName([]));
  expect(result.current.outfits[0]!.topId).toBe('gildan-5000');
  expect(stored<SavedOutfit[]>(STORAGE_KEYS.outfits)).toHaveLength(1);
});

test('deleteOutfit removes it from the outfits and from a folder that held it', async () => {
  const { result } = await renderHook(() => useCloset());
  const id = result.current.outfits[0]!.id;
  await act(() => result.current.createFolderWith('Weekend', { kind: 'outfit', id }));
  expect(result.current.folders[0]!.items).toEqual([{ kind: 'outfit', id }]);

  await act(() => result.current.deleteOutfit(id));
  expect(result.current.outfits).toEqual([]);
  expect(result.current.folders[0]!.items).toEqual([]);
});

test('unlike takes the garment out of every folder', async () => {
  const { result } = await renderHook(() => useCloset());
  await act(() => result.current.swipe('gildan-5000', 'L', true));
  expect(result.current.liked).toEqual(['gildan-5000']);
  const folderId = result.current.folders[0]!.id;
  await act(() => result.current.toggleInFolder(folderId, { kind: 'garment', id: 'gildan-5000' }));
  await act(() => result.current.createFolderWith('Tees', { kind: 'garment', id: 'gildan-5000' }));
  expect(result.current.folders.every((f) => f.items.length === 1)).toBe(true);

  await act(() => result.current.unlike('gildan-5000'));
  expect(result.current.liked).toEqual([]);
  expect(result.current.folders.every((f) => f.items.length === 0)).toBe(true);
});

test('useOutfit falls back to the empty outfit and stores what is set', async () => {
  const { result } = await renderHook(() => useOutfit());
  expect(result.current[0]).toEqual(EMPTY_OUTFIT);
  await act(() => result.current[1](outfit));
  expect(stored(STORAGE_KEYS.outfit)).toEqual(outfit);
});

test("useCatalogue falls back to 'matching' when the stored scope is invalid", async () => {
  Storage.setItemSync(STORAGE_KEYS.catalogue, JSON.stringify('everything'));
  const { result } = await renderHook(() => useCatalogue());
  expect(result.current[0]).toBe('matching');
  await act(() => result.current[1]('all'));
  expect(stored(STORAGE_KEYS.catalogue)).toBe('all');
});

test('usePreference follows the stored fit style, the same object while it is unchanged', async () => {
  Storage.setItemSync(STORAGE_KEYS.fitStyle, JSON.stringify('slim'));
  const { result, rerender } = await renderHook(() => usePreference());
  expect(result.current.source).toBe('style');
  const first = result.current;
  await rerender({});
  expect(result.current).toBe(first);
});
