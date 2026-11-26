import Storage from 'expo-sqlite/kv-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { estimateBody } from '@choudo/core/domain/body';
import { fitGarment } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Outfit } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

// measurementHint samples (uncached): counted, to check a sheet doesn't re-run it for nothing.
jest.mock('@choudo/core/domain/fit', () => {
  const actual = jest.requireActual('@choudo/core/domain/fit');
  return { ...actual, measurementHint: jest.fn(actual.measurementHint) };
});
const hint = jest.requireMock('@choudo/core/domain/fit').measurementHint as jest.Mock;

const appDir = './src/app';
const BODY = { heightCm: 176, weightKg: 75, bodyType: 'mens' } as const;
const outfit = (): Outfit => JSON.parse(Storage.getItemSync(STORAGE_KEYS.outfit)!) as Outfit;

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(BODY));
});

test('from the Fitting room: brand as kicker, a row per zone, Done for the worn size', async () => {
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=gildan-5000&size=L&from=fitting' });
  const tee = findGarment('gildan-5000')!;
  expect(screen.getByText('Gildan')).toBeTruthy();
  expect(screen.getByRole('header', { name: tee.name })).toBeTruthy();
  const fit = fitGarment(estimateBody(BODY), tee, 'L');
  for (const z of fit.zones) expect(screen.getByTestId(`zone-${z.zone}`)).toBeTruthy();
  expect(screen.queryAllByTestId(/^zone-/)).toHaveLength(fit.zones.length);
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
});

test('picking M makes the button "Wear M", which wears M and closes the sheet', async () => {
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=gildan-5000&size=L&from=fitting' });
  await fireEvent.press(screen.getByRole('radio', { name: /^M, / }));
  await fireEvent.press(screen.getByRole('button', { name: 'Wear M' }));
  expect(outfit()).toMatchObject({ topId: 'gildan-5000', topSize: 'M' });
  expect(screen).toHavePathname('/fitting-room');
});

test('from browsing: "Try L in the fitting room" wears it and goes to the Fitting room', async () => {
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=gildan-5000&size=L&from=browse' });
  await fireEvent.press(screen.getByRole('button', { name: 'Try L in the fitting room' }));
  expect(outfit()).toMatchObject({ topId: 'gildan-5000', topSize: 'L' });
  expect(screen).toHavePathname('/fitting-room');
});

test('a jacket worn in the Fitting room is read over the top under it', async () => {
  Storage.setItemSync(
    STORAGE_KEYS.outfit,
    JSON.stringify({ ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', outerId: 'port-authority-j317', outerSize: 'L' }),
  );
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=port-authority-j317&size=L&from=fitting' });
  expect(screen.getByText('With your hoodie under it')).toBeTruthy();
});

test('an unknown garment closes the sheet', async () => {
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=garment-that-does-not-exist&size=L&from=fitting' });
  // A cold start: nothing to go back to, so home (the Check tab).
  expect(screen).toHavePathname('/check');
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
});

test("Done on a worn jacket's sheet doesn't work its hint out again", async () => {
  Storage.setItemSync(
    STORAGE_KEYS.outfit,
    JSON.stringify({ ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', outerId: 'port-authority-j317', outerSize: 'L' }),
  );
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=port-authority-j317&size=L&from=fitting' });
  const before = hint.mock.calls.length;
  expect(before).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(hint.mock.calls.length).toBe(before);
});

test('no chances or percentages unless Test mode is on', async () => {
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=gildan-5000&size=L&from=fitting' });
  expect(screen.queryByText('For you')).toBeNull();
  expect(screen.queryByText('Label')).toBeNull();
  expect(screen.queryByText(/Chances come from/)).toBeNull();
  expect(screen.queryByText(/\d% chance/)).toBeNull();
});

test('Test mode shows each zone’s chances', async () => {
  Storage.setItemSync(STORAGE_KEYS.testMode, JSON.stringify(true));
  await renderRouter(appDir, { initialUrl: '/fit-details?garmentId=gildan-5000&size=L&from=fitting' });
  expect(screen.getAllByText('Label').length).toBeGreaterThan(0);
  expect(screen.getByText(/Chances come from 500 tries/)).toBeTruthy();
});
