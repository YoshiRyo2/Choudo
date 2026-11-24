import Storage from 'expo-sqlite/kv-store';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { kv, runMigrations } from './kv';

const body = JSON.stringify({ heightCm: 175, weightKg: 70, bodyType: 'mens' });

beforeEach(() => {
  Storage.clearSync();
});

test('reads back what it stores', () => {
  kv.setItem('a', '1');
  expect(kv.getItem('a')).toBe('1');
});

test('a removed key reads as null', () => {
  kv.setItem('a', '1');
  kv.removeItem('a');
  expect(kv.getItem('a')).toBeNull();
});

test('runMigrations moves a pre-rename body to the current key, once per launch', () => {
  Storage.setItemSync('nimbus.body.v2', body);
  runMigrations();
  expect(Storage.getItemSync(STORAGE_KEYS.body)).toBe(body);
  expect(Storage.getItemSync('nimbus.body.v2')).toBeNull();

  Storage.setItemSync('nimbus.body.v2', body);
  runMigrations();
  expect(Storage.getItemSync('nimbus.body.v2')).toBe(body);
});
