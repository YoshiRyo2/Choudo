import Storage from 'expo-sqlite/kv-store';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

const appDir = './src/app';
const BODY = { heightCm: 175, weightKg: 70, bodyType: 'mens' };

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const storedBody = () => JSON.parse(Storage.getItemSync(STORAGE_KEYS.body) ?? 'null');

// A value saved through a hook lasts the whole launch (the whole file here), so the
// tests that save come last.

beforeEach(() => {
  Storage.clearSync();
});

test('Edit body, change the height, Cancel: nothing saved changes', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(BODY));
  await renderRouter(appDir, { initialUrl: '/fitting-room' });
  await press('Edit body');
  await fireEvent.changeText(screen.getByLabelText('Height'), '180');
  await press('Cancel');
  expect(screen).toHavePathname('/fitting-room');
  expect(storedBody()).toEqual(BODY);
  expect(within(screen.getByTestId('stage')).getByLabelText(/^Mannequin, 175 cm tall/)).toBeTruthy();
});

test('About Choudo opens the About sheet', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(BODY));
  await renderRouter(appDir, { initialUrl: '/body' });
  await press('About Choudo');
  expect(screen).toHavePathname('/about');
  expect(screen.getByText('Your data stays on this device')).toBeTruthy();
});

test('first run with no fit reference: saving goes on to the fit reference', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.changeText(screen.getByLabelText('Height'), '170');
  await fireEvent.changeText(screen.getByLabelText('Weight'), '65');
  await press('Go to fitting room');
  expect(screen).toHavePathname('/fit-reference');
  expect(screen).toHaveSearchParams({ first: '1' });
  expect(storedBody()).toMatchObject({ heightCm: 170, weightKg: 65 });
});

test('Edit body, Save: the new body is stored and the Fitting room shows it', async () => {
  await renderRouter(appDir, { initialUrl: '/fitting-room' });
  await press('Edit body');
  await fireEvent.changeText(screen.getByLabelText('Height'), '182');
  await press('Save and go to fitting room');
  expect(screen).toHavePathname('/fitting-room');
  expect(storedBody()).toMatchObject({ heightCm: 182 });
  expect(within(screen.getByTestId('stage')).getByLabelText(/^Mannequin, 182 cm tall/)).toBeTruthy();
});
