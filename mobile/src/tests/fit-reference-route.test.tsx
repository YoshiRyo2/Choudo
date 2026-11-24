import Storage from 'expo-sqlite/kv-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

const appDir = './src/app';
const BODY = { heightCm: 175, weightKg: 70, bodyType: 'mens' };
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  Storage.clearSync();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(BODY));
});

test('a stored tee we no longer list: Edit body falls back to the plain line, the fit reference opens on choose', async () => {
  Storage.setItemSync(STORAGE_KEYS.anchor, JSON.stringify({ kind: 'catalogue', garmentId: 'gone-tee', size: 'M' }));
  await renderRouter(appDir, { initialUrl: '/body' });
  expect(screen.getByText('Not set yet, so we assume you like a regular fit.')).toBeTruthy();
  await press('Change');
  expect(screen).toHavePathname('/fit-reference');
  expect(screen.getByRole('header', { name: 'Got a tee that fits the way you like?' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
});

test('from Edit body: a style saves, clears the anchor, and goes back to Edit body', async () => {
  Storage.setItemSync(STORAGE_KEYS.anchor, JSON.stringify({ kind: 'measured', chestFlatCm: 52, lengthCm: 72 }));
  await renderRouter(appDir, { initialUrl: '/' });
  await press('Edit body');
  await press('Change');
  await press('Back');
  await press('Ask me a question instead');
  await fireEvent.press(screen.getByRole('radio', { name: /^Slim/ }));
  await press('Save');
  expect(screen).toHavePathname('/body');
  expect(Storage.getItemSync(STORAGE_KEYS.anchor)).toBeNull();
  expect(Storage.getItemSync(STORAGE_KEYS.fitStyle)).toBe('"slim"');
  expect(screen.getByText('You like tees slim.')).toBeTruthy();
});
