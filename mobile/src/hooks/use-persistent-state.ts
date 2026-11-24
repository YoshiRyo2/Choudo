import { useCallback, useState } from 'react';
import { readStored, writeStored } from '@choudo/core/ui-logic/state/persist';

import { kv } from '@/storage/kv';

/**
 * useState that survives a relaunch, stored on this phone only.
 *
 * `isValid` guards against old or corrupt data: anything that fails it is ignored and
 * the fallback is used. If storage throws, the app keeps the in-memory value.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => readStored(kv, key, fallback, isValid));

  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeStored(kv, key, next);
    },
    [key],
  );

  return [value, update];
}
