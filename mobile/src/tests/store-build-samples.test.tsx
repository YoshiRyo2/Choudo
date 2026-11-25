import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { findGarment } from '@choudo/core/domain/garments';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Folder, type Outfit, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

/**
 * A store build: no __DEV__, no DEV_TOOLS (so no Test mode), and so no "Sample data"
 * garments (Fieldline, Corvo, the ryo- tees). Likes, folders and outfits stored earlier
 * (in development, say) that point at one are skipped, never deleted.
 */
let mockDevTools = false;
jest.mock('@/utils/dev-tools', () => ({
  get DEV_TOOLS() {
    return mockDevTools;
  },
}));

const appDir = './src/app';
const at = '2026-11-01T00:00:00.000Z';
const tee = findGarment('gildan-5000')!;
const chino = findGarment('fieldline-slim-chino')!;
const oxford = findGarment('fieldline-oxford')!;
// The samples really are samples: if the seed changes, these tests say so.
expect(chino.source.placeholder).toBe(true);
expect(oxford.source.placeholder).toBe(true);
expect(tee.source.placeholder).toBeFalsy();

const plain: SavedOutfit = { ...EMPTY_OUTFIT, topId: tee.id, topSize: 'M', id: 'o1', name: 'Plain', savedAt: at };
const chinos: SavedOutfit = { ...EMPTY_OUTFIT, topId: tee.id, topSize: 'M', bottomId: chino.id, bottomSize: '32', id: 'o2', name: 'Chinos day', savedAt: at };
const folder: Folder = {
  id: 'f1',
  name: 'Work',
  items: [
    { kind: 'garment', id: oxford.id },
    { kind: 'garment', id: tee.id },
    { kind: 'outfit', id: chinos.id },
    { kind: 'outfit', id: plain.id },
  ],
};
const worn: Outfit = { ...EMPTY_OUTFIT, topId: oxford.id, topSize: 'M', bottomId: chino.id, bottomSize: '32' };
const swipes = [
  { garmentId: oxford.id, sizeShown: 'M', liked: true, at },
  { garmentId: tee.id, sizeShown: 'M', liked: true, at },
];

const stored = () =>
  [STORAGE_KEYS.outfits, STORAGE_KEYS.folders, STORAGE_KEYS.swipes, STORAGE_KEYS.outfit].map((key) => Storage.getItemSync(key));
const inCloset = () => within(screen.getByTestId('closet'));
const g = globalThis as { __DEV__?: boolean };
const wasDev = g.__DEV__;

beforeEach(() => {
  g.__DEV__ = false;
  mockDevTools = false;
  Storage.clearSync();
  forgetThisLaunch();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 175, weightKg: 70, bodyType: 'mens' }));
  Storage.setItemSync(STORAGE_KEYS.outfits, JSON.stringify([chinos, plain]));
  Storage.setItemSync(STORAGE_KEYS.folders, JSON.stringify([folder]));
  Storage.setItemSync(STORAGE_KEYS.swipes, JSON.stringify(swipes));
  Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify(worn));
});

afterEach(() => {
  g.__DEV__ = wasDev;
});

test('Liked skips a liked sample; storage keeps the like', async () => {
  const before = stored();
  await renderRouter(appDir, { initialUrl: '/closet' });
  expect(inCloset().getByRole('button', { name: `${tee.brand} ${tee.name}` })).toBeTruthy();
  expect(inCloset().queryByText(oxford.name)).toBeNull();
  expect(inCloset().getByText('All 1')).toBeTruthy();
  expect(stored()).toEqual(before);
});

test('a stored outfit with a Fieldline item does not crash and is not shown', async () => {
  const before = stored();
  await renderRouter(appDir, { initialUrl: '/closet' });
  await act(() => fireEvent.press(screen.getByText('Outfits')));
  expect(inCloset().getByRole('header', { name: 'Plain' })).toBeTruthy();
  expect(inCloset().queryByText('Chinos day')).toBeNull();
  expect(inCloset().queryByText(/Fieldline|Chino|Oxford/)).toBeNull();
  expect(stored()).toEqual(before);
});

test('a folder counts and shows only what is not a sample', async () => {
  await renderRouter(appDir, { initialUrl: '/closet' });
  await act(() => fireEvent.press(screen.getByText('Folders')));
  await act(() => fireEvent.press(screen.getByRole('button', { name: 'Work, 1 garment, 1 outfit' })));
  expect(screen).toHavePathname('/folder/f1');
  expect(screen.getByRole('button', { name: `${tee.brand} ${tee.name}` })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Plain' })).toBeTruthy();
  expect(screen.queryByText('Chinos day')).toBeNull();
  expect(screen.queryByText(oxford.name)).toBeNull();
  expect(JSON.parse(Storage.getItemSync(STORAGE_KEYS.folders)!)).toEqual([folder]);
});

test('sharing an outfit that wears a sample closes the sheet', async () => {
  await renderRouter(appDir, { initialUrl: `/share-outfit?id=${chinos.id}` });
  expect(screen).toHavePathname('/');
  expect(screen.queryByTestId('share-card')).toBeNull();
});

test('the Fitting room swaps a worn sample for a real garment, leaving storage alone', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  expect(screen.queryByText(/Fieldline/)).toBeNull();
  expect(screen.queryByText(oxford.name)).toBeNull();
  expect(JSON.parse(Storage.getItemSync(STORAGE_KEYS.outfit)!)).toEqual(worn);
});

test('with Test mode on in a fit-test build, the samples show again', async () => {
  mockDevTools = true;
  Storage.setItemSync(STORAGE_KEYS.testMode, 'true');
  await renderRouter(appDir, { initialUrl: '/closet' });
  expect(inCloset().getByText('All 2')).toBeTruthy();
  await act(() => fireEvent.press(screen.getByText('Outfits')));
  expect(inCloset().getByRole('header', { name: 'Chinos day' })).toBeTruthy();
});
