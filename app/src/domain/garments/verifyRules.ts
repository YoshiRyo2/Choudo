/**
 * Thresholds for checking seed data (stage 5, "verify"), all in cm. Tune the
 * checks here, not in verify.ts. Anything outside a range is a warning for a
 * person to review, except the flat-vs-circumference limits, which are errors.
 */

import { inToCm } from '../units';
import type { FitIntent, GarmentType, GirthKey, MeasurementKey } from './types';

export interface Range {
  min: number;
  max: number;
}

/**
 * A girth printed as "flat" above `flatMax` looks like a full circumference;
 * one printed as "circumference" below `circumferenceMin` looks like a flat width.
 * Values are the printed number in cm, before doubling. Adult sizes only.
 */
export const GIRTH_METHOD_LIMITS: Record<GirthKey, { flatMax: number; circumferenceMin: number }> = {
  chest: { flatMax: 85, circumferenceMin: 65 },
  waist: { flatMax: 75, circumferenceMin: 55 },
  hips: { flatMax: 85, circumferenceMin: 65 },
  // Pants legs, ASSUMED from typical charts (thigh 25–40 flat, opening 12–30 flat).
  thigh: { flatMax: 50, circumferenceMin: 40 },
  knee: { flatMax: 40, circumferenceMin: 28 },
  legOpening: { flatMax: 35, circumferenceMin: 22 },
};

/** Plausible garment measurements (cm, full circumferences) for tops. */
export const TOP_RANGES: Partial<Record<MeasurementKey, Range>> = {
  chest: { min: 75, max: 170 },
  waist: { min: 70, max: 160 },
  shoulder: { min: 35, max: 65 },
  // Long sleeves measured shoulder seam to cuff only; other definitions vary too much.
  sleeve: { min: 50, max: 75 },
};

/** Top length (high point of shoulder to hem) by garment type. */
export const TOP_LENGTH_RANGES: Partial<Record<GarmentType, Range>> = {
  tee: { min: 60, max: 90 },
  'long-sleeve-tee': { min: 60, max: 90 },
  polo: { min: 60, max: 90 },
  'button-up': { min: 65, max: 95 },
};

/** Plausible garment measurements (cm, full circumferences) for bottoms. */
export const BOTTOM_RANGES: Partial<Record<MeasurementKey, Range>> = {
  waist: { min: 55, max: 150 },
  hips: { min: 75, max: 170 },
  inseam: { min: 60, max: 95 },
  rise: { min: 18, max: 40 },
  // Legs, ASSUMED from typical charts: skinny to wide, small to big sizes.
  thigh: { min: 40, max: 100 },
  knee: { min: 28, max: 70 },
  legOpening: { min: 22, max: 80 },
};

/**
 * A pants thigh over this share of its seat is probably a typo or a mixed-up
 * method. Real cuts run about 0.55–0.68 (§2.5's "hips / 2 + 8" flags ordinary
 * relaxed jeans once both are full circumferences). ASSUMED.
 */
export const MAX_THIGH_TO_HIPS = 0.7;

/**
 * A typical men's / unisex body chest for each letter size, in inches: the
 * mid-points of the ranges brands commonly print (Lands' End's Super-T chart:
 * S 34–36, M 38–40, L 42–44, XL 46–48, XXL 50–52), carried on in 4 in steps.
 * APPROXIMATE — only used to judge whether a chart's chest ease is plausible.
 * Women's sizing has no reference yet, so its ease isn't checked.
 */
const REFERENCE_CHEST_IN: Record<string, number> = {
  XS: 31,
  S: 35,
  M: 39,
  L: 43,
  XL: 47,
  '2XL': 51,
  '3XL': 55,
  '4XL': 59,
  '5XL': 63,
};
const SIZE_ALIASES: Record<string, string> = { XXL: '2XL', XXXL: '3XL', XXXXL: '4XL' };

/** Typical body chest (cm) for a letter size, or null if we have no reference. */
export function referenceChestCm(label: string): number | null {
  const key = label.toUpperCase();
  const inches = REFERENCE_CHEST_IN[SIZE_ALIASES[key] ?? key];
  return inches === undefined ? null : inToCm(inches);
}

/**
 * Plausible chest ease (garment − typical body chest, cm) for each fit intent.
 * Wide on purpose: this catches a wrong method or unit, not a style choice.
 */
export const CHEST_EASE_BY_INTENT: Record<FitIntent, Range> = {
  slim: { min: -5, max: 8 },
  regular: { min: -2, max: 20 },
  relaxed: { min: 5, max: 30 },
  oversized: { min: 12, max: 45 },
};

/**
 * Pants sized by waist in inches ("32", "32x30"): garment waist minus that number
 * in cm. Labels often run a little small (vanity sizing), so the range leans positive.
 */
export const BOTTOM_WAIST_EASE: Range = { min: -4, max: 10 };

/** A size step more than this many times its neighbours' is uneven grading… */
export const GRADING_RATIO = 2;
/** …as long as it's also at least this many cm bigger than them (ignores rounding noise). */
export const GRADING_MIN_EXCESS_CM = 1;

/** An audit differing from the chart by more than this (cm) is flagged. Girths are full circumferences. */
export const AUDIT_TOLERANCE_CM = { girth: 3, length: 2 };

/**
 * A garment image narrower than this (px) fails `npm run data:check`. The cut-outs are
 * made at 900 px (`maxSide` in scripts/garment-photos.json); anything much smaller looks
 * soft on a phone screen and usually means an old or wrongly scaled file.
 */
export const MIN_IMAGE_WIDTH_PX = 800;
