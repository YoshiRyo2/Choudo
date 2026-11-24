/**
 * The phone's key-value store (SQLite-backed, kept in the app's own data, not a web
 * view's), shaped like the bit of Web Storage that @choudo/core reads and writes.
 */

import Storage from 'expo-sqlite/kv-store';
import { migrateStorage, type StorageLike } from '@choudo/core/ui-logic/state/migrate';

export const kv: StorageLike = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
};

let migrated = false;

/** Moves data saved under older keys to the current ones. Runs once per launch, before anything reads. */
export function runMigrations(): void {
  if (migrated) return;
  migrated = true;
  migrateStorage(kv);
}
