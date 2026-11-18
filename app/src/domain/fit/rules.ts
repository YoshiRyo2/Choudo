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
import type { Stretch } from '../garments';

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
