import { Alert, type AlertButton } from 'react-native';

import { confirmDelete } from './confirm-delete';

test('asks with a native alert; only Delete (destructive) goes ahead', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const onConfirm = jest.fn();
  confirmDelete('Work', onConfirm);
  expect(alert).toHaveBeenCalledTimes(1);
  const [title, , buttons] = alert.mock.calls[0]! as [string, string | undefined, AlertButton[]];
  expect(title).toBe('Delete “Work”?');
  expect(buttons.map((b) => [b.text, b.style])).toEqual([
    ['Cancel', 'cancel'],
    ['Delete', 'destructive'],
  ]);
  buttons[0]!.onPress?.();
  expect(onConfirm).not.toHaveBeenCalled();
  buttons[1]!.onPress?.();
  expect(onConfirm).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
