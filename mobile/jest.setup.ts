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

// Gesture Handler's mocks: gestures don't reach a native module, jest-utils can fire them.
require('react-native-gesture-handler/jestSetup');
// Reanimated's resolver gives Worklets its web build, which has no UI runtime to bind to:
// Gesture Handler takes its web no-op for that too.
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings', () =>
  jest.requireActual('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings.web'),
);

// Reanimated's test mode: animations jump to their end, useReducedMotion reads false.
require('react-native-reanimated').setUpTests();
