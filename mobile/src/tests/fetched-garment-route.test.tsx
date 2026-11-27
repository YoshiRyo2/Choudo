import Storage from 'expo-sqlite/kv-store';
import { renderRouter, screen, within } from 'expo-router/testing-library';
import type { BodyInput } from '@choudo/core/domain/body';
import { parseProductLink, uniqloToSeedGarment, type UniqloLink } from '@choudo/core/domain/links';
import sizeChart from '@choudo/core/domain/links/__fixtures__/uniqlo-size-charts-E424873-000.json';
import product from '@choudo/core/domain/links/__fixtures__/uniqlo-product-E424873-000.json';
import { EMPTY_OUTFIT, STORAGE_KEYS, type StoredFetched } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

const appDir = './src/app';
const WOMENS: BodyInput = { heightCm: 163, weightKg: 56, bodyType: 'womens' };
const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/00') as UniqloLink;
const converted = uniqloToSeedGarment(sizeChart, product, link, '2026-11-26');
if (!converted.ok) throw new Error(converted.reason);
const TEE: StoredFetched = { product: converted.product, fetchedAt: '2026-11-26T10:00:00.000Z' };

let consoleError: jest.SpyInstance;

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  consoleError = jest.spyOn(console, 'error');
});

afterEach(() => {
  consoleError.mockRestore();
});

test('a worn garment from a link shows once in the Fitting room carousel, with no duplicate keys', async () => {
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(WOMENS));
  Storage.setItemSync(STORAGE_KEYS.fetched, JSON.stringify([TEE]));
  Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify({ ...EMPTY_OUTFIT, topId: 'uniqlo-E424873-000', topSize: 'M' }));
  await renderRouter(appDir, { initialUrl: '/fitting-room' });

  const sameKey = consoleError.mock.calls.filter((args) => args.some((a: unknown) => String(a).includes('same key')));
  expect(sameKey).toEqual([]);
  const carousel = within(screen.getByTestId('carousel-track'));
  expect(carousel.getAllByRole('button', { name: 'Uniqlo Crew Neck T-Shirt' })).toHaveLength(1);
});
