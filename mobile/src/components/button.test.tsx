import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme';

import { Button } from './button';

test('a pressable button with its title as the name', async () => {
  const onPress = jest.fn();
  await render(<Button title="Save" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('primary is an ink fill at least 44 tall', async () => {
  await render(<Button title="Go" onPress={() => {}} />);
  const style = StyleSheet.flatten(screen.getByRole('button', { name: 'Go' }).props.style);
  expect(style).toMatchObject({ backgroundColor: colors.ink });
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
});

test('disabled is announced, but a press still reaches the screen (like aria-disabled)', async () => {
  const onPress = jest.fn();
  await render(<Button title="Save" onPress={onPress} disabled />);
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});
