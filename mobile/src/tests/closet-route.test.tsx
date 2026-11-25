import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { catalogueFor, GARMENTS } from '@choudo/core/domain/garments';
import { buildFeed } from '@choudo/core/ui-logic/state/feed';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Folder, type Outfit, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

const appDir = './src/app';
const matching = catalogueFor(GARMENTS, 'mens', 'matching');
const read = <T,>(key: string, fallback: T): T => {
  const raw = Storage.getItemSync(key);
  return raw === null ? fallback : (JSON.parse(raw) as T);
};
const press = (name: string) => act(() => fireEvent.press(screen.getByRole('button', { name })));
/** In the Closet only (the Fitting room, mounted behind it, has a Save outfit button too). */
const pressInCloset = (name: string) => act(() => fireEvent.press(within(screen.getByTestId('closet')).getByRole('button', { name })));
/** Discover's card fly-off (renderRouter runs on fake timers). */
const flyOff = () => act(() => jest.advanceTimersByTime(220));
const go = (href: '/' | '/discover' | '/closet') => act(() => router.navigate(href));

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 170, weightKg: 65, bodyType: 'mens' }));
});

test('the Closet draws nothing until it is first opened', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  expect(screen.queryByText('Nothing liked yet')).toBeNull();
  await go('/closet');
  expect(screen.getByText('Nothing liked yet')).toBeTruthy();
});

test('liked in Discover, it shows in Liked; unliked there, it is back in Discover', async () => {
  const feed = buildFeed(matching, []);
  const first = feed[0]!;
  await renderRouter(appDir, { initialUrl: '/discover' });
  await press('Like');
  await flyOff();
  await go('/closet');
  expect(screen.getByRole('button', { name: `${first.brand} ${first.name}` })).toBeTruthy();

  await press(`Unlike ${first.brand} ${first.name}`);
  expect(screen.getByText('Nothing liked yet')).toBeTruthy();
  await go('/discover');
  expect(screen.getByText(`${feed.length} to go`)).toBeTruthy();
});

test('Go to Discover goes to Discover', async () => {
  await renderRouter(appDir, { initialUrl: '/closet' });
  await press('Go to Discover');
  expect(screen).toHavePathname('/discover');
});

describe('Outfits', () => {
  const saved: SavedOutfit = { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'S', id: 'o1', name: 'Weekend', savedAt: '2026-11-01T00:00:00.000Z' };
  const showOutfits = async () => {
    await renderRouter(appDir, { initialUrl: '/closet' });
    await act(() => fireEvent.press(screen.getByText('Outfits')));
  };

  test('Save outfit saves what is on as the next Outfit N', async () => {
    await showOutfits();
    await pressInCloset('Save outfit');
    expect(read<SavedOutfit[]>(STORAGE_KEYS.outfits, []).map((o) => o.name)).toEqual(['Outfit 1']);
    expect(screen.getByRole('header', { name: 'Outfit 1' })).toBeTruthy();
  });

  test('Open wears the outfit and lands on the Fitting room', async () => {
    Storage.setItemSync(STORAGE_KEYS.outfits, JSON.stringify([saved]));
    Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify({ ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'L' }));
    await showOutfits();
    await press('Open');
    expect(screen).toHavePathname('/');
    expect(read<Outfit>(STORAGE_KEYS.outfit, EMPTY_OUTFIT)).toMatchObject({ topId: 'gildan-5000', topSize: 'S' });
  });

  test('Delete asks first, then the outfit is gone, from its folder too', async () => {
    Storage.setItemSync(STORAGE_KEYS.outfits, JSON.stringify([saved]));
    Storage.setItemSync(STORAGE_KEYS.folders, JSON.stringify([{ id: 'f1', name: 'Work', items: [{ kind: 'outfit', id: 'o1' }] }] satisfies Folder[]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await showOutfits();
    await press('Delete');
    expect(alert).toHaveBeenCalledWith('Delete “Weekend”?', undefined, expect.any(Array));
    expect(read<SavedOutfit[]>(STORAGE_KEYS.outfits, [])).toEqual([]);
    expect(read<Folder[]>(STORAGE_KEYS.folders, [])[0]!.items).toEqual([]);
    expect(screen.queryByRole('header', { name: 'Weekend' })).toBeNull();
    alert.mockRestore();
  });

  test('Share opens the share sheet for that outfit', async () => {
    Storage.setItemSync(STORAGE_KEYS.outfits, JSON.stringify([saved]));
    await showOutfits();
    await press('Share');
    expect(screen).toHavePathname('/share-outfit');
    expect(screen).toHaveSearchParams({ id: 'o1' });
  });
});

test('Folders: New folder, then open it', async () => {
  await renderRouter(appDir, { initialUrl: '/closet' });
  await act(() => fireEvent.press(screen.getByText('Folders')));
  await act(() => fireEvent.changeText(screen.getByLabelText('New folder'), 'Work'));
  await press('Create');
  const [work] = read<Folder[]>(STORAGE_KEYS.folders, []);
  expect(work?.name).toBe('Work');
  await press('Work, Empty');
  expect(screen).toHavePathname(`/folder/${work!.id}`);
});

test('Add to folder on a liked garment opens the folder picker for it', async () => {
  const first = buildFeed(matching, [])[0]!;
  Storage.setItemSync(STORAGE_KEYS.swipes, JSON.stringify([{ garmentId: first.id, sizeShown: 'M', liked: true, at: '2026-11-01T00:00:00.000Z' }]));
  await renderRouter(appDir, { initialUrl: '/closet' });
  await press('Add to folder');
  expect(screen).toHavePathname('/folder-picker');
  expect(screen).toHaveSearchParams({ kind: 'garment', id: first.id, title: first.name });
});

test('About opens the About sheet', async () => {
  await renderRouter(appDir, { initialUrl: '/closet' });
  await press('About');
  expect(screen).toHavePathname('/about');
});
