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

// The segmented control is SwiftUI on iOS, which Jest can't render: tests get the JS
// version @expo/ui vendors for the web (same props, a tappable button per segment).
jest.mock('@expo/ui/community/segmented-control', () => {
  const { SegmentedControl } = jest.requireActual(
    '../node_modules/@expo/ui/build/community/segmented-control/vendor/SegmentedControl',
  );
  return { __esModule: true, default: SegmentedControl, SegmentedControl };
});

// Reanimated's test mode: animations jump to their end, useReducedMotion reads false.
require('react-native-reanimated').setUpTests();
