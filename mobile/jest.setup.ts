// expo-sqlite is native: tests get an in-memory key-value store with the same sync API.
jest.mock('expo-sqlite/kv-store', () => {
  const data = new Map<string, string>();
  const Storage = {
    getItemSync: (key: string) => data.get(key) ?? null,
    setItemSync: (key: string, value: string) => void data.set(key, value),
    removeItemSync: (key: string) => data.delete(key),
    clearSync: () => {
      data.clear();
      return true;
    },
  };
  return { __esModule: true, default: Storage, Storage };
});
