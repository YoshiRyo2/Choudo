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

// Last: it saves through the hooks, and what they save lasts the rest of this file.
test('first run end to end: Body, then Skip for now on the fit reference, lands in the tabs', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  expect(screen).toHavePathname('/body');
  await fireEvent.changeText(screen.getByLabelText('Height'), '170');
  await fireEvent.changeText(screen.getByLabelText('Weight'), '65');
  await fireEvent.press(screen.getByRole('button', { name: 'Go to fitting room' }));
  expect(screen).toHavePathname('/fit-reference');
  await fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
  expect(screen).toHavePathname('/');
  expect(JSON.parse(Storage.getItemSync(STORAGE_KEYS.body)!)).toMatchObject({ heightCm: 170, weightKg: 65 });
  expect(Storage.getItemSync(STORAGE_KEYS.anchor)).toBeNull();
});
