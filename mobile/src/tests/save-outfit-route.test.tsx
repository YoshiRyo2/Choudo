import Storage from 'expo-sqlite/kv-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { MAX_NAME_LENGTH, nextOutfitName } from '@choudo/core/ui-logic/state/closet';
import { EMPTY_OUTFIT, STORAGE_KEYS, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

const appDir = './src/app';
const saved = (): SavedOutfit[] => JSON.parse(Storage.getItemSync(STORAGE_KEYS.outfits) ?? '[]') as SavedOutfit[];

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 176, weightKg: 75, bodyType: 'mens' }));
  Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify({ ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'L' }));
});

test('a blank name saves under the next default name, then says where it went', async () => {
  await renderRouter(appDir, { initialUrl: '/save-outfit' });
  expect(screen.getByRole('header', { name: 'Save this outfit' })).toBeTruthy();
  expect(screen.getByLabelText('Name').props.placeholder).toBe(nextOutfitName([]));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(saved()).toHaveLength(1);
  expect(saved()[0]).toMatchObject({ name: nextOutfitName([]), topId: 'gildan-5000', topSize: 'L' });
  expect(screen.getByRole('header', { name: 'Saved to your Closet' })).toBeTruthy();
  expect(screen.getByText('Find it under Closet → Outfits.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen).toHavePathname('/fitting-room');
});

test('the outfit saved is the one on the mannequin: a stale stored one is resolved first', async () => {
  Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify(EMPTY_OUTFIT));
  await renderRouter(appDir, { initialUrl: '/save-outfit' });
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(saved()[0]!.topId).not.toBeNull();
  expect(saved()[0]!.bottomId).not.toBeNull();
});

test(`a long name is kept to ${MAX_NAME_LENGTH} characters`, async () => {
  await renderRouter(appDir, { initialUrl: '/save-outfit' });
  const box = screen.getByLabelText('Name');
  expect(box.props.maxLength).toBe(MAX_NAME_LENGTH);
  // A paste can get past maxLength on some keyboards; the closet trims it anyway.
  await fireEvent.changeText(box, 'x'.repeat(60));
  await fireEvent(box, 'submitEditing');
  expect(saved()[0]!.name).toHaveLength(MAX_NAME_LENGTH);
});
