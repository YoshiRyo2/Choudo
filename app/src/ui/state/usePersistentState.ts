import { useCallback, useState } from 'react';

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
  const [value, setValue] = useState<T>(() => read(key, fallback, isValid));

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        if (next === null || next === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage blocked or full: keep the in-memory value.
      }
    },
    [key],
  );

  return [value, update];
}

function read<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
