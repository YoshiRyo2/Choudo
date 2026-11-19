/**
 * Fit thresholds, all in cm. Tune fit behaviour here, not in fitEngine.ts.
 *
 * Girth zones compare garment − body ("ease"):
 *   ease < tightBelow            -> tight
 *   ease ≤ fittedMax             -> fitted
 *   ease ≤ relaxedMax            -> relaxed
 *   otherwise                    -> loose
 *
 * Length zones compare garment − target length from the body:
 *   diff < shortBelow            -> short
 *   diff > longAbove             -> long
 *   otherwise                    -> good
 *
 * `ideal` is the difference we'd most like to see; recommendSize uses it.
 */

import { inToCm } from '../units';
import type { FitIntent, GarmentSizing, Stretch } from '../garments';

export interface GirthRule {
  kind: 'girth';
  tightBelow: number;
  fittedMax: number;
  relaxedMax: number;
  ideal: number;
}

export interface LengthRule {
  kind: 'length';
  shortBelow: number;
  longAbove: number;
  ideal: number;
}

/**
 * Top chest. Ported from src/fit.py, which works in inches:
 *   Tight < −1 in, Fitted ≤ 2 in, Relaxed ≤ 4 in, else Loose.
 */
export const TOP_CHEST: GirthRule = {
  kind: 'girth',
  tightBelow: inToCm(-1),
  fittedMax: inToCm(2),
  relaxedMax: inToCm(4),
  ideal: inToCm(1),
};

/** Shirt waist (button-ups list it): treated like the chest. */
export const TOP_WAIST: GirthRule = TOP_CHEST;

/**
 * Bust on a top cut for women (garment sizing "womens"). Women's fitted tees are
 * cut closer to the body, so the bands sit nearer zero. ASSUMED, not sourced yet
 * (no women's charts or fit tests in the data) — replace from fit-test results:
 *  - tightBelow −1 in: unchanged from men's. Tight is about the body, not the cut.
 *  - fittedMax +1 in (men's +2): one inch closer, per Ryo's spec that women's
 *    fitted tees run closer to the body.
 *  - relaxedMax +3 in (men's +4): the same one-inch shift.
 *  - ideal +0.5 in (men's +1): half way into the narrower fitted band.
 * Unisex and men's tops keep the men's numbers, whoever wears them.
 */
export const WOMENS_TOP_CHEST: GirthRule = {
  kind: 'girth',
  tightBelow: inToCm(-1),
  fittedMax: inToCm(1),
  relaxedMax: inToCm(3),
  ideal: inToCm(0.5),
};

/** A women's shirt waist: treated like its bust. */
export const WOMENS_TOP_WAIST: GirthRule = WOMENS_TOP_CHEST;

/** Top chest and waist rules by the garment's sizing. Bottoms use one set for everyone for now. */
export const TOP_GIRTH_RULES: Record<GarmentSizing, { chest: GirthRule; waist: GirthRule }> = {
  mens: { chest: TOP_CHEST, waist: TOP_WAIST },
  unisex: { chest: TOP_CHEST, waist: TOP_WAIST },
  womens: { chest: WOMENS_TOP_CHEST, waist: WOMENS_TOP_WAIST },
};

/** Pants waistband: much less room to play with than a shirt. */
export const BOTTOM_WAIST: GirthRule = {
  kind: 'girth',
  tightBelow: -2,
  fittedMax: 3,
  relaxedMax: 6,
  ideal: 1,
};

/** Pants seat. */
export const BOTTOM_HIPS: GirthRule = {
  kind: 'girth',
  tightBelow: 0,
  fittedMax: 6,
  relaxedMax: 12,
  ideal: 3,
};

/** Top length vs. body torso length (high shoulder point -> hip line). */
export const TOP_LENGTH: LengthRule = { kind: 'length', shortBelow: -4, longAbove: 5, ideal: 1 };

/** Long sleeve (shoulder seam -> cuff) vs. arm length (shoulder -> wrist). */
export const SLEEVE: LengthRule = { kind: 'length', shortBelow: -2, longAbove: 4, ideal: 1 };

/** Pants inseam vs. body inseam. */
export const INSEAM: LengthRule = { kind: 'length', shortBelow: -2.5, longAbove: 3, ideal: 0 };

/**
 * Stretch fabric can measure smaller than the body without feeling tight. We move
 * the "tight" boundary down by this fraction of the body measurement.
 * (Elastic waistbands are "high".)
 */
export const STRETCH_ALLOWANCE: Record<Stretch, number> = {
  none: 0,
  some: 0.04,
  high: 0.2,
};

/** A length off by more than this many times its threshold is flagged as a problem, not just a note. */
export const LENGTH_FAR_MULTIPLIER = 2;

// ---------- personal fit (preference.ts) ----------

/**
 * Target chest ease (garment − body, full circumference, cm) for each way a tee
 * can be cut, and how far either side of it still "fits how you like". The same
 * table serves the user's stated style ("How do you like tees to fit?") and a
 * garment's `fitIntent`. Assumed, approved for phase 3:
 *   slim      +2.5 cm (1 in — the engine's old ideal)   ±3 cm
 *   regular   +5 cm   (2 in)                             ±4 cm
 *   relaxed   +8 cm   (≈3 in)                            ±5 cm
 *   oversized +18 cm  (≈7 in, like the Fieldline boxy sample) ±8 cm
 */
export const INTENT_EASE: Record<FitIntent, { easeCm: number; bandCm: number }> = {
  slim: { easeCm: 2.5, bandCm: 3 },
  regular: { easeCm: 5, bandCm: 4 },
  relaxed: { easeCm: 8, bandCm: 5 },
  oversized: { easeCm: 18, bandCm: 8 },
};

/** With an anchor tee we know exactly what the user likes, so the band is fixed. */
export const ANCHOR_CHEST_BAND_CM = 4;

/** A top's length within this of the anchor's (relative to the body) "fits how you like". */
export const ANCHOR_LENGTH_BAND_CM = 4;

/** Chest ease this far over the target reads "much roomier", not just "roomier". */
export const MUCH_ROOMIER_CM = 10;

/** Designs looser than regular: when their own ease is above the user's, the design wins ("as designed"). */
export const LOOSE_INTENTS: readonly FitIntent[] = ['relaxed', 'oversized'];
