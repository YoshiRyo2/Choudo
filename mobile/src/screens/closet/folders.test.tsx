import { fireEvent, render, screen } from '@testing-library/react-native';
import { GARMENTS, publicGarments, type Garment } from '@choudo/core/domain/garments';
import { EMPTY_OUTFIT, type Folder, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { Folders } from './folders';

const work: Folder = { id: 'f1', name: 'Work', items: [{ kind: 'garment', id: 'gildan-5000' }, { kind: 'outfit', id: 'o1' }] };

const at = '2026-11-01T00:00:00.000Z';
const OUTFITS: SavedOutfit[] = [
  { ...EMPTY_OUTFIT, topId: 'gildan-5000', topSize: 'M', id: 'o1', name: 'Plain', savedAt: at },
  { ...EMPTY_OUTFIT, bottomId: 'fieldline-slim-chino', bottomSize: '32', id: 'o2', name: 'Chinos', savedAt: at },
];

async function show(folders: Folder[], garments: readonly Garment[] = GARMENTS) {
  const onCreate = jest.fn();
  const onOpenFolder = jest.fn();
  await render(<Folders folders={folders} outfits={OUTFITS} garments={garments} onCreate={onCreate} onOpenFolder={onOpenFolder} />);
  return { onCreate, onOpenFolder };
}

test('no folders yet: the note, and New folder makes one', async () => {
  const { onCreate } = await show([]);
  expect(screen.getByText('No folders yet. Make one here, then use “Add to folder” on a liked garment or a saved outfit.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('New folder'), 'Work');
  await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
  expect(onCreate).toHaveBeenCalledWith('Work');
});

test('a row per folder with what it holds; tapping one opens it', async () => {
  const { onOpenFolder } = await show([work]);
  expect(screen.getByText('Work')).toBeTruthy();
  expect(screen.getByText('1 garment, 1 outfit')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Work, 1 garment, 1 outfit' }));
  expect(onOpenFolder).toHaveBeenCalledWith('f1');
});

test('a store build: a folder counts only what it shows (no samples, no outfit wearing one)', async () => {
  const mixed: Folder = {
    id: 'f2',
    name: 'Mixed',
    items: [
      { kind: 'garment', id: 'gildan-5000' },
      { kind: 'garment', id: 'fieldline-oxford' },
      { kind: 'outfit', id: 'o1' },
      { kind: 'outfit', id: 'o2' },
    ],
  };
  await show([mixed], publicGarments(GARMENTS, { includeSamples: false }));
  expect(screen.getByText('1 garment, 1 outfit')).toBeTruthy();
});
