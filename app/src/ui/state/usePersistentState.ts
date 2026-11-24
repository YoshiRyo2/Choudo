import { useCallback, useState } from 'react';
import type { StorageLike } from '@choudo/core/ui-logic/state/migrate';
import { readStored, writeStored } from '@choudo/core/ui-logic/state/persist';

/**
 * useState that survives a reload, stored in this browser only (localStorage).
 *
 * `isValid` guards against old or hand-edited data: anything that fails it is
 * ignored and the fallback is used. Storage can be unavailable (private mode,
 * blocked site data), so every access is wrapped — the app keeps working, it
 * just won't remember.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => readStored(browserStorage(), key, fallback, isValid));

  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeStored(browserStorage(), key, next);
    },
    [key],
  );

  return [value, update];
}

/** localStorage, or null where reading it throws (Safari with storage blocked). */
function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
