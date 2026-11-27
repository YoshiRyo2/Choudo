import Storage from 'expo-sqlite/kv-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

const appDir = './src/app';

beforeEach(() => {
  Storage.clearSync();
});

test('the lab opens with an empty store (development build)', async () => {
  await renderRouter(appDir, { initialUrl: '/dev/mannequin' });
  expect(screen).toHavePathname('/dev/mannequin');
  expect(screen.getByRole('header', { name: 'Mannequin lab' })).toBeTruthy();
  expect(screen.getByLabelText('Mannequin, 163 cm tall')).toBeTruthy();
});

test('the Fitting room has a Mannequin lab button in development', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 175, weightKg: 70, bodyType: 'mens' }));
  await renderRouter(appDir, { initialUrl: '/fitting-room' });
  await fireEvent.press(screen.getByRole('button', { name: 'Mannequin lab' }));
  expect(screen).toHavePathname('/dev/mannequin');
  expect(screen.getByLabelText('Mannequin, 175 cm tall')).toBeTruthy();
});

test('a store build (no __DEV__) redirects the lab to the Fitting room and hides the button', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 175, weightKg: 70, bodyType: 'mens' }));
  const g = globalThis as { __DEV__?: boolean };
  const was = g.__DEV__;
  g.__DEV__ = false;
  try {
    await renderRouter(appDir, { initialUrl: '/dev/mannequin' });
    expect(screen).toHavePathname('/fitting-room');
    expect(screen.queryByRole('button', { name: 'Mannequin lab' })).toBeNull();
  } finally {
    g.__DEV__ = was;
  }
});
