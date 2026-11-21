/**
 * Everything Choudo keeps on the device, with the guards used when reading it
 * back. Bump a key's version when its shape changes.
 */

import { validateBodyInput, type BodyInput } from '../../domain/body';
import { FIT_STYLES, validateMeasuredAnchor, type Anchor, type FitStyle } from '../../domain/fit';
import { CATALOGUE_SCOPES, type CatalogueScope } from '../../domain/garments';

export const STORAGE_KEYS = {
  /** v2: `sizing` became `bodyType`, plus an optional bra size (migrate.ts moves v1 over). */
  body: 'choudo.body.v2',
  units: 'choudo.units.v1',
  /** v2: a jacket slot (outerId, outerSize); migrate.ts moves v1 over. */
  outfit: 'choudo.outfit.v2',
  swipes: 'choudo.swipes.v1',
  folders: 'choudo.folders.v1',
  /** v2: each saved outfit has a jacket slot too. */
  outfits: 'choudo.outfits.v2',
  /** A tee the user owns and likes the fit of (or null). */
  anchor: 'choudo.anchor.v1',
  /** The answer to "How do you like tees to fit?" (or null). */
  fitStyle: 'choudo.fitStyle.v1',
  /** Whether the hidden Test mode is on. */
  testMode: 'choudo.testMode.v1',
  /** Garments to show: "matching" (the body type's sizing plus unisex) or "all". */
  catalogue: 'choudo.catalogue.v1',
  /** Results recorded in Test mode. v2: each prediction's body uses `bodyType`. */
  fitTests: 'choudo.fitTests.v3',
} as const;

/** Display units. Metric = cm + kg, imperial = in + lb. Storage is always metric. */
export type UnitSystem = 'metric' | 'imperial';

export interface Outfit {
  topId: string | null;
  topSize: string | null;
  bottomId: string | null;
  bottomSize: string | null;
  /** A jacket or coat over the top, or null. */
  outerId: string | null;
  outerSize: string | null;
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

/** A named top + bottom (+ jacket), with sizes, saved from the fitting room. */
export interface SavedOutfit extends Outfit {
  id: string;
  name: string;
  savedAt: string;
}

/** A tester's answer about a girth: the chest on a top, the waist or thigh on a bottom. */
export type GirthAnswer = 'too-tight' | 'just-right' | 'too-loose';
/** A tester's answer about the chest. */
export type ChestAnswer = GirthAnswer;
/** A tester's answer about the length. */
export type LengthAnswer = 'too-short' | 'just-right' | 'too-long';
export const CHEST_ANSWERS: readonly ChestAnswer[] = ['too-tight', 'just-right', 'too-loose'];
export const LENGTH_ANSWERS: readonly LengthAnswer[] = ['too-short', 'just-right', 'too-long'];

/** What a Test-mode result is about: a top, a bottom or an outer layer (a jacket). */
export type FitTestCategory = 'top' | 'bottom' | 'outer';

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
  /**
   * What was recorded: a top (chest + length), a bottom (waist, thigh + inseam) or
   * an outer layer (chest + sleeve). Records from v2 are tops.
   */
  category: FitTestCategory;
  body: BodyInput;
  chestCm: number;
  chestSource: 'estimated' | 'entered';
  torsoLengthCm: number;
  preferenceSource: 'anchor' | 'style' | 'default';
  /** Stated style, or "regular". */
  style: string;
  /** "Gildan 5000 in M", "measured 53 × 74 cm", or "" without one. */
  anchor: string;
  /** null on a bottom: there's no chest target. */
  preferredChestEaseCm: number | null;
  preferredLengthDiffCm: number | null;
  recommendedSize: string | null;
  /** The most likely verdict for this size, and the chance it fits how you like. */
  verdict: string;
  likes: number;
  /** Objective labels at the point estimate. On a bottom, length is the inseam and the chest is "unknown". */
  chestLabel: string;
  lengthLabel: string;
  chest: ZoneChances;
  length: ZoneChances;
  // ---- bottoms only ----
  inseamCm?: number;
  /** The body's girth where the waistband sits. */
  waistCm?: number;
  thighCm?: number;
  waistLabel?: string;
  thighLabel?: string;
  waist?: ZoneChances;
  thigh?: ZoneChances;
  // ---- outer layers ----
  /** What was worn under it, "gildan-18500 L"; absent when it was tried on alone. */
  wornOver?: string;
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
  category: FitTestCategory;
  /** Tops only (null on a bottom). */
  chest: GirthAnswer | null;
  /** Bottoms only. The thigh is only asked when the app could score it. */
  waist?: GirthAnswer;
  thigh?: GirthAnswer;
  /** A top's length, or a bottom's inseam. */
  length: LengthAnswer;
  /** The size they'd keep, or null for none. */
  keptSize: string | null;
  prediction: FitTestPrediction;
}

export const EMPTY_OUTFIT: Outfit = { topId: null, topSize: null, bottomId: null, bottomSize: null, outerId: null, outerSize: null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStringOrNull = (v: unknown) => v === null || typeof v === 'string';

function isBraSize(v: unknown): boolean {
  return isRecord(v) && typeof v.band === 'number' && typeof v.cup === 'string' && (v.system === 'us' || v.system === 'uk');
}

export function isStoredBody(v: unknown): v is BodyInput | null {
  if (v === null) return true;
  if (!isRecord(v)) return false;
  if (typeof v.heightCm !== 'number' || typeof v.weightKg !== 'number') return false;
  if (v.bodyType !== 'mens' && v.bodyType !== 'womens') return false;
  if (v.overrides !== undefined && !isRecord(v.overrides)) return false;
  if (isRecord(v.overrides) && v.overrides.braSize !== undefined && !isBraSize(v.overrides.braSize)) return false;
  return validateBodyInput(v as unknown as BodyInput).length === 0;
}

export const isUnitSystem = (v: unknown): v is UnitSystem => v === 'metric' || v === 'imperial';

export function isOutfit(v: unknown): v is Outfit {
  return (
    isRecord(v) &&
    isStringOrNull(v.topId) &&
    isStringOrNull(v.topSize) &&
    isStringOrNull(v.bottomId) &&
    isStringOrNull(v.bottomSize) &&
    isStringOrNull(v.outerId) &&
    isStringOrNull(v.outerSize)
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

export const isCatalogueScope = (v: unknown): v is CatalogueScope =>
  typeof v === 'string' && (CATALOGUE_SCOPES as readonly string[]).includes(v);

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isZoneChances(v: unknown): v is ZoneChances {
  return isRecord(v) && isNumber(v.under) && isNumber(v.right) && isNumber(v.over);
}

// Widened with jackets ('outer'); every older record still reads, so the key stays v3.
const isCategory = (v: unknown): v is FitTestCategory => v === 'top' || v === 'bottom' || v === 'outer';
const optional = <T>(guard: (x: unknown) => x is T) => (x: unknown) => x === undefined || guard(x);
const isGirthAnswer = (v: unknown): v is GirthAnswer => (CHEST_ANSWERS as readonly unknown[]).includes(v);

function isPrediction(v: unknown): v is FitTestPrediction {
  return (
    isRecord(v) &&
    isCategory(v.category) &&
    isStoredBody(v.body) &&
    v.body !== null &&
    isNumber(v.chestCm) &&
    (v.chestSource === 'estimated' || v.chestSource === 'entered') &&
    isNumber(v.torsoLengthCm) &&
    (v.preferenceSource === 'anchor' || v.preferenceSource === 'style' || v.preferenceSource === 'default') &&
    isString(v.style) &&
    isString(v.anchor) &&
    (v.preferredChestEaseCm === null || isNumber(v.preferredChestEaseCm)) &&
    (v.preferredLengthDiffCm === null || isNumber(v.preferredLengthDiffCm)) &&
    isStringOrNull(v.recommendedSize) &&
    isString(v.verdict) &&
    isNumber(v.likes) &&
    isString(v.chestLabel) &&
    isString(v.lengthLabel) &&
    isZoneChances(v.chest) &&
    isZoneChances(v.length) &&
    optional(isNumber)(v.inseamCm) &&
    optional(isNumber)(v.waistCm) &&
    optional(isNumber)(v.thighCm) &&
    optional(isString)(v.waistLabel) &&
    optional(isString)(v.thighLabel) &&
    optional(isZoneChances)(v.waist) &&
    optional(isZoneChances)(v.thigh) &&
    optional(isString)(v.wornOver)
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
    isCategory(v.category) &&
    (v.chest === null || isGirthAnswer(v.chest)) &&
    optional(isGirthAnswer)(v.waist) &&
    optional(isGirthAnswer)(v.thigh) &&
    (LENGTH_ANSWERS as readonly unknown[]).includes(v.length) &&
    isStringOrNull(v.keptSize) &&
    isPrediction(v.prediction)
  );
}

export const isFitTestList = isArrayOf(isFitTestRecord);
