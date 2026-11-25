import { useCallback, useEffect, useState } from 'react';
import { readStored, writeStored } from '@choudo/core/ui-logic/state/persist';

import { kv } from '@/storage/kv';

/**
 * Values set during this launch, by key, and the hooks to tell when one changes. Every
 * screen using a key sees the same value, even when storage refused the write.
 */
const setThisLaunch = new Map<string, unknown>();
const listeners = new Map<string, Set<(value: unknown) => void>>();

/**
 * Forget the values set during this launch, as a relaunch would (tests: start each one from
 * what's in storage). Mounted hooks keep what they show until they read again.
 */
export function forgetThisLaunch() {
  setThisLaunch.clear();
}

function current<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  return setThisLaunch.has(key) ? (setThisLaunch.get(key) as T) : readStored(kv, key, fallback, isValid);
}

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
  const [value, setValue] = useState<T>(() => current(key, fallback, isValid));

  useEffect(() => {
    const listener = (next: unknown) => setValue(next as T);
    let forKey = listeners.get(key);
    if (!forKey) listeners.set(key, (forKey = new Set()));
    forKey.add(listener);
    // A change made between this render and subscribing.
    if (setThisLaunch.has(key)) setValue(setThisLaunch.get(key) as T);
    return () => {
      forKey.delete(listener);
    };
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setThisLaunch.set(key, next);
      listeners.get(key)?.forEach((listener) => listener(next));
      writeStored(kv, key, next);
    },
    [key],
  );

  return [value, update];
}
