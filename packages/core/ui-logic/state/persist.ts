/**
 * Reading and writing one stored value, for any StorageLike (localStorage on the web,
 * the native key-value store on the phone). Storage can be missing, blocked or full,
 * and values can be old or hand-edited, so neither function ever throws.
 */

import type { StorageLike } from './migrate';

/** The stored value under `key` when it parses and passes `isValid`; otherwise `fallback`. */
export function readStored<T>(
  storage: StorageLike | null,
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T {
  try {
    const raw = storage?.getItem(key) ?? null;
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Saves `next` as JSON under `key`; null or undefined removes the key. */
export function writeStored(storage: StorageLike | null, key: string, next: unknown): void {
  try {
    if (!storage) return;
    if (next === null || next === undefined) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the caller keeps its in-memory value.
  }
}
