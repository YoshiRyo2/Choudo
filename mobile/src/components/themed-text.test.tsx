import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

const styleOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style);

test('body text in medium ink by default', async () => {
  await render(<ThemedText>Hi</ThemedText>);
  expect(styleOf('Hi')).toMatchObject({ fontFamily: 'MPLUSRounded1c_500Medium', fontSize: 16, color: '#2a2140' });
});

test('headline is 42 in extra bold', async () => {
  await render(<ThemedText variant="headline">Big</ThemedText>);
  expect(styleOf('Big')).toMatchObject({ fontFamily: 'MPLUSRounded1c_800ExtraBold', fontSize: 42 });
});

test('muted tone', async () => {
  await render(<ThemedText tone="muted">Quiet</ThemedText>);
  expect(styleOf('Quiet')).toMatchObject({ color: '#6b5f73' });
});

test("the caller's style wins", async () => {
  await render(
    <ThemedText tone="muted" style={{ color: '#000000', fontSize: 20 }}>
      Mine
    </ThemedText>,
  );
  expect(styleOf('Mine')).toMatchObject({ color: '#000000', fontSize: 20, fontFamily: 'MPLUSRounded1c_500Medium' });
});
