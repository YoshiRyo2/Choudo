import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Folder } from '@choudo/core/ui-logic/state/stored';

import { Folders } from './folders';

const work: Folder = { id: 'f1', name: 'Work', items: [{ kind: 'garment', id: 'gildan-5000' }, { kind: 'outfit', id: 'o1' }] };

async function show(folders: Folder[]) {
  const onCreate = jest.fn();
  const onOpenFolder = jest.fn();
  await render(<Folders folders={folders} onCreate={onCreate} onOpenFolder={onOpenFolder} />);
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
