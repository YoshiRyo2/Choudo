import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { findGarment } from '@choudo/core/domain/garments';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Folder, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

const appDir = './src/app';
const at = '2026-11-01T00:00:00.000Z';
const tee = findGarment('gildan-5000')!;
const outfit: SavedOutfit = { ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', id: 'o1', name: 'Weekend', savedAt: at };
type Node = { type: string; props: { title?: string }; children?: (Node | string)[] | null };
/** The native stack's header titles (not drawn as text in Jest: they're props on the header config). */
function headerTitles(): string[] {
  const out: string[] = [];
  const walk = (n: Node | string | null | (Node | string)[]): void => {
    if (!n || typeof n === 'string') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'RNSScreenStackHeaderConfig' && n.props.title) out.push(n.props.title);
    (n.children ?? []).forEach(walk);
  };
  walk(screen.toJSON() as unknown as Node);
  return out;
}
const folders = (): Folder[] => JSON.parse(Storage.getItemSync(STORAGE_KEYS.folders) ?? '[]') as Folder[];

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 170, weightKg: 65, bodyType: 'mens' }));
  Storage.setItemSync(STORAGE_KEYS.swipes, JSON.stringify([{ garmentId: tee.id, sizeShown: 'M', liked: true, at }]));
  Storage.setItemSync(STORAGE_KEYS.outfits, JSON.stringify([outfit]));
  const work: Folder = { id: 'f1', name: 'Work', items: [{ kind: 'garment', id: tee.id }, { kind: 'outfit', id: 'o1' }] };
  Storage.setItemSync(STORAGE_KEYS.folders, JSON.stringify([work]));
});

/** The Fitting room first, then the folder pushed on top (as the Closet does). */
async function openFolder(id = 'f1') {
  await renderRouter(appDir, { initialUrl: '/' });
  await act(() => router.push(`/folder/${id}`));
}

test('a folder shows the garment and the outfit it holds', async () => {
  await openFolder();
  expect(screen.getByRole('button', { name: `${tee.brand} ${tee.name}` })).toBeTruthy();
  expect(screen.getByText('Weekend')).toBeTruthy();
});

test('Remove takes one item out', async () => {
  await openFolder();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Remove' })[0]!);
  expect(folders()[0]!.items).toEqual([{ kind: 'outfit', id: 'o1' }]);
  expect(screen.queryByRole('button', { name: `${tee.brand} ${tee.name}` })).toBeNull();
});

test('Rename changes the folder name', async () => {
  await openFolder();
  expect(headerTitles()).toContain('Work');
  await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));
  await fireEvent.changeText(screen.getByLabelText('Folder name'), 'Gym');
  await fireEvent.press(screen.getAllByRole('button', { name: 'Rename' }).at(-1)!);
  expect(folders()[0]!.name).toBe('Gym');
  expect(headerTitles()).toContain('Gym');
  expect(headerTitles()).not.toContain('Work');
});

test('Delete asks, then the folder is gone and the screen goes back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });
  await openFolder();
  expect(screen).toHavePathname('/folder/f1');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(alert).toHaveBeenCalledWith('Delete “Work”?', undefined, expect.any(Array));
  expect(folders()).toEqual([]);
  expect(screen).toHavePathname('/');
  alert.mockRestore();
});

test('a folder that no longer exists goes back', async () => {
  await openFolder('folder-that-is-gone');
  expect(screen).toHavePathname('/');
});

test('opening a garment in it goes to Fit details, from browsing', async () => {
  await openFolder();
  await fireEvent.press(screen.getByRole('button', { name: `${tee.brand} ${tee.name}` }));
  expect(screen).toHavePathname('/fit-details');
  expect(screen).toHaveSearchParams(expect.objectContaining({ garmentId: tee.id, from: 'browse' }));
});

test('Open on an outfit in a folder (from the Closet) wears it on the Fitting room', async () => {
  Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify({ ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'S' }));
  await renderRouter(appDir, { initialUrl: '/closet' });
  await act(() => router.push('/folder/f1'));
  await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
  expect(screen).toHavePathname('/');
  expect(JSON.parse(Storage.getItemSync(STORAGE_KEYS.outfit)!)).toMatchObject({ topId: 'gildan-18500', topSize: 'L' });
});
