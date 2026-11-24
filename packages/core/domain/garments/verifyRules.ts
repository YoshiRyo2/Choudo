/**
 * Thresholds for checking seed data (stage 5, "verify"), all in cm. Tune the
 * checks here, not in verify.ts. Anything outside a range is a warning for a
 * person to review, except the flat-vs-circumference limits, which are errors.
 */

import { inToCm } from '../units';
import type { FitIntent, GarmentType, GirthKey, MeasurementKey, SleeveDefinition } from './types';

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
  // Knit rib hem band, relaxed. ASSUMED: a little under the chest's limits (bands run narrower than the body).
  hemBand: { flatMax: 75, circumferenceMin: 55 },
  // A skirt's hem sweep, ASSUMED: a pencil skirt is about 90 cm round, so 45 flat; a full skirt runs to 300+.
  hemSweep: { flatMax: 120, circumferenceMin: 70 },
  // Leggings calf, ASSUMED: a compression calf is about 25–40 cm round, so 12–20 flat.
  calf: { flatMax: 30, circumferenceMin: 18 },
};

/**
 * Knits run bigger than tees: a 5XL hoodie is 34 in (86 cm) flat across the
 * chest, past the tee limit. ASSUMED; still well under an adult chest
 * circumference printed by mistake (100 cm and up).
 */
export const KNIT_GIRTH_METHOD_LIMITS: Partial<typeof GIRTH_METHOD_LIMITS> = {
  chest: { flatMax: 95, circumferenceMin: 65 },
};

/** Plausible garment measurements (cm, full circumferences) for tops. */
export const TOP_RANGES: Partial<Record<MeasurementKey, Range>> = {
  chest: { min: 75, max: 170 },
  waist: { min: 70, max: 160 },
  shoulder: { min: 35, max: 65 },
};

/** Long sleeves by where they're measured from. Tops check shoulder seam to cuff only; other definitions vary too much. */
export const TOP_SLEEVE_RANGES: Partial<Record<SleeveDefinition, Range>> = {
  shoulder_to_cuff: { min: 50, max: 75 },
};

/**
 * Plausible knit measurements (hoodies, sweatshirts), cm, full circumferences.
 * ASSUMED from typical charts: knits run bigger than tees (a 5XL hoodie is 34 in
 * flat, 173 cm round), and a rib hem band runs narrower than the chest.
 */
export const KNIT_RANGES: Partial<Record<MeasurementKey, Range>> = {
  chest: { min: 80, max: 180 },
  shoulder: { min: 35, max: 75 },
  hemBand: { min: 60, max: 150 },
};

/**
 * Knit long sleeves: shoulder seam to cuff as tops, and centre back to cuff
 * (half the back plus the sleeve; Gildan's 18500 runs 32½–40 in). ASSUMED.
 */
export const KNIT_SLEEVE_RANGES: Partial<Record<SleeveDefinition, Range>> = {
  shoulder_to_cuff: { min: 50, max: 75 },
  center_back_to_cuff: { min: 70, max: 110 },
};

/** Knit length (high point of shoulder to hem) by garment type. ASSUMED, as tees. */
export const KNIT_LENGTH_RANGES: Partial<Record<GarmentType, Range>> = {
  hoodie: { min: 55, max: 90 },
  sweatshirt: { min: 55, max: 90 },
  sweater: { min: 55, max: 90 },
  cardigan: { min: 55, max: 95 },
};

/**
 * Plausible jacket and coat measurements, cm, full circumferences. ASSUMED from
 * typical charts: a jacket goes over a top, so it runs bigger than a knit (a 6XL
 * soft shell is 71 in round), and a shoulder seam sits near the shoulder point.
 */
export const JACKET_RANGES: Partial<Record<MeasurementKey, Range>> = {
  chest: { min: 85, max: 190 },
  waist: { min: 75, max: 180 },
  shoulder: { min: 38, max: 62 },
};

/** Jacket long sleeves, by where they're measured from. ASSUMED (J317 runs 34¼–40½ in from the centre back). */
export const JACKET_SLEEVE_RANGES: Partial<Record<SleeveDefinition, Range>> = {
  shoulder_to_cuff: { min: 50, max: 80 },
  center_back_to_cuff: { min: 70, max: 110 },
};

/** Jacket length (high point of shoulder to hem): to the hip and thigh for jackets, down to the calf for coats. ASSUMED. */
export const JACKET_LENGTH_RANGES: Partial<Record<GarmentType, Range>> = {
  jacket: { min: 50, max: 100 },
  coat: { min: 70, max: 125 },
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
 * Plausible shorts measurements, cm, full circumferences: the bottoms ranges with
 * a short inseam (2 in running shorts to 13 in board shorts) and a leg opening
 * cut round the thigh rather than the ankle. ASSUMED from typical charts.
 */
export const SHORTS_RANGES: Partial<Record<MeasurementKey, Range>> = {
  ...BOTTOM_RANGES,
  inseam: { min: 5, max: 35 },
  legOpening: { min: 40, max: 100 },
};

/**
 * Plausible skirt measurements, cm, full circumferences. ASSUMED from typical
 * charts: a mini from about 35 cm, a maxi to about 110 cm from the waist; the
 * sweep from a pencil skirt's 80 cm to a full circle's 400.
 */
export const SKIRT_RANGES: Partial<Record<MeasurementKey, Range>> = {
  waist: { min: 55, max: 150 },
  hips: { min: 75, max: 170 },
  length: { min: 30, max: 130 },
  hemSweep: { min: 70, max: 400 },
};

/**
 * Plausible dress measurements, cm (full circumference). ASSUMED: a bust from a
 * size 00 to a 30W plus a fitted wearing ease, a waist and hips as a skirt's, a
 * hem from a pencil sheath to a full circle, shoulders from a narrow women's 30 cm.
 */
export const DRESS_RANGES: Partial<Record<MeasurementKey, Range>> = {
  chest: { min: 70, max: 170 },
  waist: { min: 55, max: 160 },
  hips: { min: 75, max: 175 },
  hemSweep: { min: 70, max: 400 },
  shoulder: { min: 30, max: 55 },
};

/** Dress length from the high point of the shoulder, mini to maxi. ASSUMED. */
export const DRESS_LENGTH_RANGES: Range = { min: 70, max: 160 };

/** Dress long sleeves, by where they're measured from. ASSUMED: as a jacket's. */
export const DRESS_SLEEVE_RANGES: Partial<Record<SleeveDefinition, Range>> = JACKET_SLEEVE_RANGES;

/**
 * Plausible leggings measurements, cm, full circumferences. ASSUMED: cut under
 * the body (Sport-Tek's XS hips 75 cm round, 4XL 123), so lower than pants;
 * a capri's inseam from about 30 cm to a long legging's 85.
 */
export const LEGGINGS_RANGES: Partial<Record<MeasurementKey, Range>> = {
  waist: { min: 45, max: 140 },
  hips: { min: 55, max: 150 },
  thigh: { min: 30, max: 80 },
  calf: { min: 20, max: 55 },
  inseam: { min: 30, max: 85 },
};

/** A skirt chart's hip point, cm below the top of the waistband. ASSUMED (charts print 6–9 in). */
export const SKIRT_HIP_DROP_RANGE: Range = { min: 5, max: 30 };

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
