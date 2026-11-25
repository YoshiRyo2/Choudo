import { fireEvent, render, screen } from '@testing-library/react-native';
import { estimateBody } from '@choudo/core/domain/body';
import { GARMENTS, publicGarments, type Garment } from '@choudo/core/domain/garments';
import { outfitLine } from '@choudo/core/ui-logic/closetText';
import { outfitOf } from '@choudo/core/ui-logic/state/closet';
import { EMPTY_OUTFIT, type Outfit, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { Outfits } from './outfits';

const model = estimateBody({ heightCm: 170, weightKg: 65, bodyType: 'mens' });
const current: Outfit = { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'M', bottomId: 'fieldline-slim-chino', bottomSize: '32' };
const saved: SavedOutfit = { ...current, id: 'o1', name: 'Weekend', savedAt: '2026-11-01T00:00:00.000Z' };
const gone: SavedOutfit = { ...EMPTY_OUTFIT, topId: 'garment-that-is-gone', topSize: 'M', id: 'o2', name: 'Old', savedAt: '2026-10-01T00:00:00.000Z' };

const realOnly = publicGarments(GARMENTS, { includeSamples: false });

async function show(outfits: SavedOutfit[], garments: readonly Garment[] = GARMENTS, now: Outfit = current) {
  const props = { onSave: jest.fn(), onOpen: jest.fn(), onShare: jest.fn(), onDelete: jest.fn(), onFolders: jest.fn() };
  await render(<Outfits model={model} garments={garments} outfits={outfits} current={now} folderCount={() => 0} {...props} />);
  return props;
}

test('what is on now, and Save outfit with a blank name (the caller names it)', async () => {
  const { onSave } = await show([]);
  expect(screen.getByText(outfitLine(current))).toBeTruthy();
  expect(screen.getByText(/^In the fitting room now:/)).toBeTruthy();
  expect(screen.getByPlaceholderText('Outfit 1')).toBeTruthy();
  expect(screen.getByText('No saved outfits yet. Put something together in the fitting room, then save it here.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save outfit' }));
  expect(onSave).toHaveBeenCalledWith('');
});

test('a saved outfit: its name and garments; Open, Share, Delete and folders', async () => {
  const { onOpen, onShare, onDelete, onFolders } = await show([saved]);
  expect(screen.getByText('Weekend')).toBeTruthy();
  expect(screen.getAllByText(outfitLine(saved)).length).toBe(2); // the card above says the same
  expect(screen.getByLabelText(/^Mannequin, /)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
  expect(onOpen).toHaveBeenCalledWith(outfitOf(saved));
  await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  expect(onShare).toHaveBeenCalledWith('o1');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(onDelete).toHaveBeenCalledWith('o1', 'Weekend');
  await fireEvent.press(screen.getByRole('button', { name: 'Add to folder' }));
  expect(onFolders).toHaveBeenCalledWith(saved);
});

test('an outfit whose garments are gone still shows, on the bare mannequin', async () => {
  await show([gone]);
  expect(screen.getByText('Old')).toBeTruthy();
  expect(screen.getByText('These garments are no longer available')).toBeTruthy();
  expect(screen.getByLabelText(/^Mannequin, /)).toBeTruthy();
});

test('a store build: an outfit wearing a sample (Fieldline) is skipped, though it stays stored', async () => {
  const tee: SavedOutfit = { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'M', id: 'o3', name: 'Plain', savedAt: '2026-09-01T00:00:00.000Z' };
  const hidden: SavedOutfit = { ...saved, name: 'Outfit 1' };
  await show([hidden, tee], realOnly, { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'M' });
  expect(screen.queryByText('Outfit 1')).toBeNull();
  expect(screen.getByText('Plain')).toBeTruthy();
  // The next name still counts the hidden one: no two outfits end up "Outfit 1".
  expect(screen.getByPlaceholderText('Outfit 2')).toBeTruthy();
});

test('a store build: what is on now leaves a sample out of its line', async () => {
  await show([], realOnly);
  expect(screen.getByText(outfitLine(current, realOnly))).toBeTruthy();
  expect(outfitLine(current, realOnly)).not.toMatch(/Chino/);
});
