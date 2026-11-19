/**
 * Everything Nimbus keeps on the device, with the guards used when reading it
 * back. Bump a key's version when its shape changes.
 */

import { validateBodyInput, type BodyInput } from '../../domain/body';

export const STORAGE_KEYS = {
  body: 'nimbus.body.v1',
  units: 'nimbus.units.v1',
  outfit: 'nimbus.outfit.v1',
  swipes: 'nimbus.swipes.v1',
  folders: 'nimbus.folders.v1',
  outfits: 'nimbus.outfits.v1',
} as const;

/** Display units. Metric = cm + kg, imperial = in + lb. Storage is always metric. */
export type UnitSystem = 'metric' | 'imperial';

export interface Outfit {
  topId: string | null;
  topSize: string | null;
  bottomId: string | null;
  bottomSize: string | null;
}

/** One like or pass in Discover. `at` is an ISO timestamp. */
export interface Swipe {
  garmentId: string;
  /** The size the card showed when it was swiped. */
  sizeShown: string;
  liked: boolean;
  at: string;
}

/** What a folder can hold: a liked garment or a saved outfit, by id. */
export interface FolderItem {
  kind: 'garment' | 'outfit';
  id: string;
}

export interface Folder {
  id: string;
  name: string;
  items: FolderItem[];
}

/** A named top + bottom (with sizes) saved from the fitting room. */
export interface SavedOutfit extends Outfit {
  id: string;
  name: string;
  savedAt: string;
}

export const EMPTY_OUTFIT: Outfit = { topId: null, topSize: null, bottomId: null, bottomSize: null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStringOrNull = (v: unknown) => v === null || typeof v === 'string';

export function isStoredBody(v: unknown): v is BodyInput | null {
  if (v === null) return true;
  if (!isRecord(v)) return false;
  if (typeof v.heightCm !== 'number' || typeof v.weightKg !== 'number') return false;
  if (v.sizing !== 'mens' && v.sizing !== 'womens') return false;
  if (v.overrides !== undefined && !isRecord(v.overrides)) return false;
  return validateBodyInput(v as unknown as BodyInput).length === 0;
}

export const isUnitSystem = (v: unknown): v is UnitSystem => v === 'metric' || v === 'imperial';

export function isOutfit(v: unknown): v is Outfit {
  return (
    isRecord(v) &&
    isStringOrNull(v.topId) &&
    isStringOrNull(v.topSize) &&
    isStringOrNull(v.bottomId) &&
    isStringOrNull(v.bottomSize)
  );
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isArrayOf =
  <T>(guard: (item: unknown) => item is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

function isSwipe(v: unknown): v is Swipe {
  return (
    isRecord(v) && isString(v.garmentId) && isString(v.sizeShown) && typeof v.liked === 'boolean' && isString(v.at)
  );
}

function isFolderItem(v: unknown): v is FolderItem {
  return isRecord(v) && (v.kind === 'garment' || v.kind === 'outfit') && isString(v.id);
}

function isFolder(v: unknown): v is Folder {
  return isRecord(v) && isString(v.id) && isString(v.name) && isArrayOf(isFolderItem)(v.items);
}

function isSavedOutfit(v: unknown): v is SavedOutfit {
  return isOutfit(v) && isRecord(v) && isString(v.id) && isString(v.name) && isString(v.savedAt);
}

export const isSwipeList = isArrayOf(isSwipe);
export const isFolderList = isArrayOf(isFolder);
export const isSavedOutfitList = isArrayOf(isSavedOutfit);
