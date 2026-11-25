import Storage from 'expo-sqlite/kv-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { STORAGE_KEYS, type Folder, type SavedOutfit, type Swipe } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

const appDir = './src/app';
const at = '2026-11-01T00:00:00.000Z';
const read = <T,>(key: string): T => JSON.parse(Storage.getItemSync(key) ?? '[]') as T;
const url = (kind: string, id: string) => `/folder-picker?kind=${kind}&id=${id}&title=${encodeURIComponent('Heavy Cotton T-Shirt (5000)')}`;

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 170, weightKg: 65, bodyType: 'mens' }));
  const swipes: Swipe[] = [{ garmentId: 'gildan-5000', sizeShown: 'M', liked: true, at }];
  Storage.setItemSync(STORAGE_KEYS.swipes, JSON.stringify(swipes));
  Storage.setItemSync(STORAGE_KEYS.folders, JSON.stringify([{ id: 'f1', name: 'Work', items: [] }] satisfies Folder[]));
});

test('ticking a folder puts the garment in it', async () => {
  await renderRouter(appDir, { initialUrl: url('garment', 'gildan-5000') });
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Work' }));
  expect(read<Folder[]>(STORAGE_KEYS.folders)[0]!.items).toEqual([{ kind: 'garment', id: 'gildan-5000' }]);
  expect(screen.getByRole('checkbox', { name: 'Work' }).props.accessibilityState).toMatchObject({ checked: true });
});

test('creating a folder makes one holding the item', async () => {
  await renderRouter(appDir, { initialUrl: url('garment', 'gildan-5000') });
  await fireEvent.changeText(screen.getByLabelText('New folder'), 'Summer');
  await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
  const made = read<Folder[]>(STORAGE_KEYS.folders).find((f) => f.name === 'Summer');
  expect(made?.items).toEqual([{ kind: 'garment', id: 'gildan-5000' }]);
});

test('an outfit can be filed too', async () => {
  const outfit: SavedOutfit = {
    id: 'o1',
    name: 'Outfit 1',
    savedAt: at,
    topId: 'gildan-5000',
    topSize: 'M',
    bottomId: null,
    bottomSize: null,
    outerId: null,
    outerSize: null,
    onepieceId: null,
    onepieceSize: null,
  };
  Storage.setItemSync(STORAGE_KEYS.outfits, JSON.stringify([outfit]));
  await renderRouter(appDir, { initialUrl: url('outfit', 'o1') });
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Work' }));
  expect(read<Folder[]>(STORAGE_KEYS.folders)[0]!.items).toEqual([{ kind: 'outfit', id: 'o1' }]);
});

test('an item that is no longer liked (or saved) closes the sheet', async () => {
  await renderRouter(appDir, { initialUrl: url('garment', 'gildan-18500') });
  expect(screen).toHavePathname('/');
  expect(screen.queryByRole('checkbox')).toBeNull();
});
