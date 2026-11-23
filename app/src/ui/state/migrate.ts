/**
 * Moving data saved by older versions to the current keys. Runs once at start-up,
 * before anything reads storage; safe to run again (it only moves what's left).
 */

import type { BodyInput } from '../../domain/body';
import { isFitTestList, isOutfit, isSavedOutfitList, isStoredBody, STORAGE_KEYS, type FitTestRecord, type Outfit, type SavedOutfit } from './stored';

/** Only the bits of Storage we use, so tests can pass a plain object. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Keys from before v2. They only ever existed under the old app name. */
export const LEGACY_KEYS = {
  bodyV1: 'nimbus.body.v1',
  fitTestsV1: 'nimbus.fitTests.v1',
  fitTestsV2: 'choudo.fitTests.v2',
  /** v2 under the app's old name, from before the rename (the rename only moves current keys). */
  fitTestsV2Old: 'nimbus.fitTests.v2',
  /** Outfits before the jacket slot, under both app names. */
  outfitV1: 'choudo.outfit.v1',
  outfitV1Old: 'nimbus.outfit.v1',
  outfitsV1: 'choudo.outfits.v1',
  outfitsV1Old: 'nimbus.outfits.v1',
  /** Outfits before the dress slot, under both app names. */
  outfitV2: 'choudo.outfit.v2',
  outfitV2Old: 'nimbus.outfit.v2',
  outfitsV2: 'choudo.outfits.v2',
  outfitsV2Old: 'nimbus.outfits.v2',
} as const;

/** The app was called Nimbus; its keys started with this prefix before the rename to Choudo. */
export const OLD_PREFIX = 'nimbus.';
export const PREFIX = 'choudo.';

/** The pre-rename name of a current key: "choudo.body.v2" -> "nimbus.body.v2". */
export const oldNameOf = (key: string): string => OLD_PREFIX + key.slice(PREFIX.length);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * A v1 body ({ heightCm, weightKg, sizing, overrides }) as a v2 BodyInput. v1's
 * `sizing` becomes `bodyType`; a body without one (or with junk) is men's, the old
 * default. Null when it isn't a usable body.
 */
export function migrateBodyV1(v: unknown): BodyInput | null {
  if (!isRecord(v)) return null;
  const { sizing, ...rest } = v;
  const next = { ...rest, bodyType: sizing === 'womens' ? 'womens' : 'mens' };
  return isStoredBody(next) && next !== null ? (next as BodyInput) : null;
}

/** v1 fit-test records, with each prediction's body moved to v2, then on to v3. Records that still don't fit are dropped. */
export function migrateFitTestsV1(v: unknown): FitTestRecord[] {
  if (!Array.isArray(v)) return [];
  const v2: unknown[] = [];
  for (const r of v) {
    if (!isRecord(r) || !isRecord(r.prediction)) continue;
    const body = migrateBodyV1(r.prediction.body);
    if (body) v2.push({ ...r, prediction: { ...r.prediction, body } });
  }
  return migrateFitTestsV2(v2);
}

/** v2 fit-test records to v3: every v2 result was a top. Records that don't fit are dropped. */
export function migrateFitTestsV2(v: unknown): FitTestRecord[] {
  if (!Array.isArray(v)) return [];
  const out: FitTestRecord[] = [];
  for (const r of v) {
    if (!isRecord(r) || !isRecord(r.prediction)) continue;
    const next: unknown[] = [{ ...r, category: 'top', prediction: { ...r.prediction, category: 'top' } }];
    if (isFitTestList(next)) out.push(...next);
  }
  return out;
}

const NO_JACKET = { outerId: null, outerSize: null } as const;
const NO_DRESS = { onepieceId: null, onepieceSize: null } as const;

/** An older outfit with empty slots added. Null when it isn't an outfit. */
function withSlots(v: unknown, slots: object): Outfit | null {
  if (!isRecord(v)) return null;
  const next = { ...v, ...slots };
  return isOutfit(next) ? next : null;
}

/** Older saved outfits with empty slots added. Entries that don't fit are dropped. */
function savedWithSlots(v: unknown, slots: object): SavedOutfit[] {
  if (!Array.isArray(v)) return [];
  const out: SavedOutfit[] = [];
  for (const o of v) {
    const next = [isRecord(o) ? { ...o, ...slots } : o];
    if (isSavedOutfitList(next)) out.push(...next);
  }
  return out;
}

/** A v1 outfit (top and bottom) as v3, with empty jacket and dress slots. Null when it isn't an outfit. */
export const migrateOutfitV1 = (v: unknown): Outfit | null => withSlots(v, { ...NO_JACKET, ...NO_DRESS });

/** v1 saved outfits as v3 (empty jacket and dress slots each). Entries that don't fit are dropped. */
export const migrateSavedOutfitsV1 = (v: unknown): SavedOutfit[] => savedWithSlots(v, { ...NO_JACKET, ...NO_DRESS });

/** A v2 outfit (top, bottom, jacket) as v3, with an empty dress slot. Null when it isn't an outfit. */
export const migrateOutfitV2 = (v: unknown): Outfit | null => withSlots(v, NO_DRESS);

/** v2 saved outfits as v3 (an empty dress slot each). Entries that don't fit are dropped. */
export const migrateSavedOutfitsV2 = (v: unknown): SavedOutfit[] => savedWithSlots(v, NO_DRESS);

function readJson(storage: StorageLike, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Move one legacy key to its new key (unless the new one already has data), then drop the old one. */
function move(storage: StorageLike, from: string, to: string, convert: (v: unknown) => unknown) {
  const old = readJson(storage, from);
  if (old === undefined) return;
  if (storage.getItem(to) === null) {
    const next = convert(old);
    if (next !== null && !(Array.isArray(next) && next.length === 0)) storage.setItem(to, JSON.stringify(next));
  }
  storage.removeItem(from);
}

/**
 * The Nimbus -> Choudo rename: copy each `nimbus.*` key to its `choudo.*` key when that one
 * is still empty, then delete the old key. When both exist, the new one wins.
 */
export function migrateAppRename(storage: StorageLike): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    const from = oldNameOf(key);
    const old = storage.getItem(from);
    if (old === null) continue;
    if (storage.getItem(key) === null) storage.setItem(key, old);
    storage.removeItem(from);
  }
}

/** Run every migration. Storage can be blocked (private mode): then there's nothing to move. */
export function migrateStorage(given?: StorageLike): void {
  try {
    const storage = given ?? globalThis.localStorage;
    if (!storage) return;
    // Rename first, so a current-version key beats a v1 one, as it did before the rename.
    migrateAppRename(storage);
    move(storage, LEGACY_KEYS.bodyV1, STORAGE_KEYS.body, migrateBodyV1);
    // Newest first: move() never overwrites, so the most recent data wins.
    move(storage, LEGACY_KEYS.fitTestsV2, STORAGE_KEYS.fitTests, migrateFitTestsV2);
    move(storage, LEGACY_KEYS.fitTestsV2Old, STORAGE_KEYS.fitTests, migrateFitTestsV2);
    move(storage, LEGACY_KEYS.fitTestsV1, STORAGE_KEYS.fitTests, migrateFitTestsV1);
    move(storage, LEGACY_KEYS.outfitV2, STORAGE_KEYS.outfit, migrateOutfitV2);
    move(storage, LEGACY_KEYS.outfitV2Old, STORAGE_KEYS.outfit, migrateOutfitV2);
    move(storage, LEGACY_KEYS.outfitsV2, STORAGE_KEYS.outfits, migrateSavedOutfitsV2);
    move(storage, LEGACY_KEYS.outfitsV2Old, STORAGE_KEYS.outfits, migrateSavedOutfitsV2);
    move(storage, LEGACY_KEYS.outfitV1, STORAGE_KEYS.outfit, migrateOutfitV1);
    move(storage, LEGACY_KEYS.outfitV1Old, STORAGE_KEYS.outfit, migrateOutfitV1);
    move(storage, LEGACY_KEYS.outfitsV1, STORAGE_KEYS.outfits, migrateSavedOutfitsV1);
    move(storage, LEGACY_KEYS.outfitsV1Old, STORAGE_KEYS.outfits, migrateSavedOutfitsV1);
  } catch {
    // Storage unavailable or full: the app falls back to defaults.
  }
}
