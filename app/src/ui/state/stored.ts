/**
 * Everything Nimbus keeps on the device, with the guards used when reading it
 * back. Bump a key's version when its shape changes.
 */

import { validateBodyInput, type BodyInput } from '../../domain/body';
import { FIT_STYLES, validateMeasuredAnchor, type Anchor, type FitStyle } from '../../domain/fit';

export const STORAGE_KEYS = {
  body: 'nimbus.body.v1',
  units: 'nimbus.units.v1',
  outfit: 'nimbus.outfit.v1',
  swipes: 'nimbus.swipes.v1',
  folders: 'nimbus.folders.v1',
  outfits: 'nimbus.outfits.v1',
  /** A tee the user owns and likes the fit of (or null). */
  anchor: 'nimbus.anchor.v1',
  /** The answer to "How do you like tees to fit?" (or null). */
  fitStyle: 'nimbus.fitStyle.v1',
  /** Whether the hidden Test mode is on. */
  testMode: 'nimbus.testMode.v1',
  /** Results recorded in Test mode. */
  fitTests: 'nimbus.fitTests.v1',
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

/** A tester's answer about the chest. */
export type ChestAnswer = 'too-tight' | 'just-right' | 'too-loose';
/** A tester's answer about the length. */
export type LengthAnswer = 'too-short' | 'just-right' | 'too-long';
export const CHEST_ANSWERS: readonly ChestAnswer[] = ['too-tight', 'just-right', 'too-loose'];
export const LENGTH_ANSWERS: readonly LengthAnswer[] = ['too-short', 'just-right', 'too-long'];

/** Chance of under / right / over for one zone. */
export interface ZoneChances {
  under: number;
  right: number;
  over: number;
}

/**
 * What the app predicted when the result was recorded. Kept with the answer, so
 * later changes to the engine don't rewrite old predictions.
 */
export interface FitTestPrediction {
  body: BodyInput;
  chestCm: number;
  chestSource: 'estimated' | 'entered';
  torsoLengthCm: number;
  preferenceSource: 'anchor' | 'style' | 'default';
  /** Stated style, or "regular". */
  style: string;
  /** "Gildan 5000 in M", "measured 53 × 74 cm", or "" without one. */
  anchor: string;
  preferredChestEaseCm: number;
  preferredLengthDiffCm: number | null;
  recommendedSize: string | null;
  /** The most likely verdict for this size, and the chance it fits how you like. */
  verdict: string;
  likes: number;
  /** Objective labels at the point estimate. */
  chestLabel: string;
  lengthLabel: string;
  chest: ZoneChances;
  length: ZoneChances;
}

/** One tester, one garment, one size: how it actually fit. */
export interface FitTestRecord {
  id: string;
  /** Tester code, e.g. "T03". */
  tester: string;
  /** ISO timestamp. */
  at: string;
  garmentId: string;
  size: string;
  chest: ChestAnswer;
  length: LengthAnswer;
  /** The size they'd keep, or null for none. */
  keptSize: string | null;
  prediction: FitTestPrediction;
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

export function isAnchor(v: unknown): v is Anchor | null {
  if (v === null) return true;
  if (!isRecord(v)) return false;
  if (v.kind === 'catalogue') return isString(v.garmentId) && isString(v.size);
  if (v.kind === 'measured') {
    return (
      typeof v.chestFlatCm === 'number' &&
      typeof v.lengthCm === 'number' &&
      validateMeasuredAnchor({ chestFlatCm: v.chestFlatCm, lengthCm: v.lengthCm }).length === 0
    );
  }
  return false;
}

export const isFitStyle = (v: unknown): v is FitStyle | null =>
  v === null || (typeof v === 'string' && (FIT_STYLES as readonly string[]).includes(v));

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isZoneChances(v: unknown): v is ZoneChances {
  return isRecord(v) && isNumber(v.under) && isNumber(v.right) && isNumber(v.over);
}

function isPrediction(v: unknown): v is FitTestPrediction {
  return (
    isRecord(v) &&
    isStoredBody(v.body) &&
    v.body !== null &&
    isNumber(v.chestCm) &&
    (v.chestSource === 'estimated' || v.chestSource === 'entered') &&
    isNumber(v.torsoLengthCm) &&
    (v.preferenceSource === 'anchor' || v.preferenceSource === 'style' || v.preferenceSource === 'default') &&
    isString(v.style) &&
    isString(v.anchor) &&
    isNumber(v.preferredChestEaseCm) &&
    (v.preferredLengthDiffCm === null || isNumber(v.preferredLengthDiffCm)) &&
    isStringOrNull(v.recommendedSize) &&
    isString(v.verdict) &&
    isNumber(v.likes) &&
    isString(v.chestLabel) &&
    isString(v.lengthLabel) &&
    isZoneChances(v.chest) &&
    isZoneChances(v.length)
  );
}

function isFitTestRecord(v: unknown): v is FitTestRecord {
  return (
    isRecord(v) &&
    isString(v.id) &&
    isString(v.tester) &&
    isString(v.at) &&
    isString(v.garmentId) &&
    isString(v.size) &&
    (CHEST_ANSWERS as readonly unknown[]).includes(v.chest) &&
    (LENGTH_ANSWERS as readonly unknown[]).includes(v.length) &&
    isStringOrNull(v.keptSize) &&
    isPrediction(v.prediction)
  );
}

export const isFitTestList = isArrayOf(isFitTestRecord);
