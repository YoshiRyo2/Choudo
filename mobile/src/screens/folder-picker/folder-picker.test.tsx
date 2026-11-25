import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Folder } from '@choudo/core/ui-logic/state/stored';

import { FolderPicker } from '.';

const item = { kind: 'garment', id: 'gildan-5000' } as const;
const folders: Folder[] = [
  { id: 'f1', name: 'Work', items: [item] },
  { id: 'f2', name: 'Summer', items: [] },
];

async function show(list: Folder[]) {
  const onToggle = jest.fn();
  const onCreate = jest.fn();
  await render(<FolderPicker title="Heavy Cotton T-Shirt (5000)" item={item} folders={list} onToggle={onToggle} onCreate={onCreate} />);
  return { onToggle, onCreate };
}

test('a checkbox per folder, ticked where the item already is', async () => {
  const { onToggle } = await show(folders);
  expect(screen.getByText('Folders')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Heavy Cotton T-Shirt (5000)' })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Work' }).props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getByRole('checkbox', { name: 'Summer' }).props.accessibilityState).toMatchObject({ checked: false });
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Summer' }));
  expect(onToggle).toHaveBeenCalledWith('f2');
});

test('no folders yet: says so, and a new one can be named', async () => {
  const { onCreate } = await show([]);
  expect(screen.getByText('No folders yet. Name one to put this in it.')).toBeTruthy();
  expect(screen.getByPlaceholderText('e.g. Work, Summer')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('New folder'), 'Gym');
  await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
  expect(onCreate).toHaveBeenCalledWith('Gym');
});
