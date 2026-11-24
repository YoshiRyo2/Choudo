import Storage from 'expo-sqlite/kv-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

// The real routes. renderRouter resolves this from the working directory (mobile/).
const appDir = './src/app';

beforeEach(() => {
  Storage.clearSync();
});

test('first launch, nothing stored: lands on Body, not the tabs', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  expect(screen).toHavePathname('/body');
});

test('a stored body opens the Fitting room', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 175, weightKg: 70, bodyType: 'mens' }));
  await renderRouter(appDir, { initialUrl: '/' });
  expect(screen).toHavePathname('/');
  expect(screen.getByText('Fitting room')).toBeTruthy();
  expect(screen.getByText(/175 cm/)).toBeTruthy();
});

test('a corrupt stored body is treated as none', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, '{"heightCm": "tall"');
  await renderRouter(appDir, { initialUrl: '/' });
  expect(screen).toHavePathname('/body');
});

test('Edit body in the Fitting room opens the Body screen', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 175, weightKg: 70, bodyType: 'mens' }));
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(screen.getByRole('button', { name: 'Edit body' }));
  expect(screen).toHavePathname('/body');
});
