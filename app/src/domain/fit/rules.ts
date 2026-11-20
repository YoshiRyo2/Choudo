/**
 * Fit thresholds, all in cm. Tune fit behaviour here, not in fitEngine.ts.
 *
 * Girth zones compare garment − body ("ease"):
 *   ease < tightBelow            -> tight
 *   ease ≤ fittedMax             -> fitted
 *   ease ≤ relaxedMax            -> relaxed
 *   otherwise                    -> loose
 * A rule's bounds are cm, or (scale "fraction") a share of the body measurement,
 * which may sit below zero for garments meant to be smaller than the body
 * (leggings: about −8 %). Stretch lowers "tight" further; see STRETCH_ALLOWANCE.
 *
 * Length zones compare garment − target length from the body:
 *   diff < shortBelow            -> short
 *   diff > longAbove             -> long
 *   otherwise                    -> good
 *
 * Landing zones only say where something ends (a hem above the knee, a waistband
 * below the navel). They never make a size good or bad.
 *
 * `ideal` is the difference we'd most like to see; recommendSize uses it.
 */

import { inToCm } from '../units';
import type { BodyMeasurements } from '../body';
import type { FitIntent, Garment, GarmentSizing, SizeMeasurements, Stretch } from '../garments';

export interface GirthRule {
  kind: 'girth';
  /** What the bounds are in: cm of ease (the default), or a fraction of the body measurement (−0.08 = 8 % under it). */
  scale?: 'cm' | 'fraction';
  tightBelow: number;
  fittedMax: number;
  relaxedMax: number;
  ideal: number;
  /** This zone's own stretch allowances, where they differ from STRETCH_ALLOWANCE (a fraction of the body, per level). */
  stretch?: Partial<Record<Stretch, number>>;
}

export interface LengthRule {
  kind: 'length';
  shortBelow: number;
  longAbove: number;
  ideal: number;
}

/**
 * Where a garment edge lands, relative to the zone's body target (cm, garment −
 * target). Marks are lowest first; the result is the last mark at or below the
 * difference (the first mark when it's below them all).
 */
export interface LandingRule {
  kind: 'landing';
  marks: readonly { label: string; atCm: number }[];
  /**
   * A hard stop: where the edge lands makes the garment unwearable (a band below
   * the hip line, a hem that can't pass the heel). Returns the label to report
   * (tone bad) and why, or null. Only blocking makes a landing zone count.
   */
  blocks?: (ctx: LandingContext) => { label: 'tight' | 'short'; note: string } | null;
}

export interface LandingContext {
  body: BodyMeasurements;
  garment: Garment;
  size: SizeMeasurements;
  garmentCm: number;
}

/** A girth rule with its bounds in cm of ease, for one body measurement. cm rules come back unchanged. */
export function girthRuleInCm(rule: GirthRule, bodyCm: number): GirthRule {
  if ((rule.scale ?? 'cm') === 'cm') return rule;
  return {
    ...rule,
    scale: 'cm',
    tightBelow: rule.tightBelow * bodyCm,
    fittedMax: rule.fittedMax * bodyCm,
    relaxedMax: rule.relaxedMax * bodyCm,
    ideal: rule.ideal * bodyCm,
  };
}

/** How far stretch moves this zone's "tight" boundary down, as a fraction of the body measurement. */
export function stretchAllowance(rule: GirthRule | LengthRule | LandingRule, stretch: Stretch): number {
  return (rule.kind === 'girth' ? rule.stretch?.[stretch] : undefined) ?? STRETCH_ALLOWANCE[stretch];
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

/**
 * Pants thigh (garment thigh − body thigh). ASSUMED, not sourced yet (no pants
 * fit tests): a little closer than the seat, since a thigh has less to move.
 * Tune with Test mode.
 */
export const THIGH: GirthRule = {
  kind: 'girth',
  tightBelow: -1,
  fittedMax: 5,
  relaxedMax: 10,
  ideal: 3,
};

/**
 * Where a pants waistband sits, by garment front rise − body front rise (cm along
 * the body; × RISE_VERTICAL_RATIO is how far below the navel). ASSUMED marks:
 * high from 2 cm short (about 1.5 cm below the navel, or above it), mid down to
 * 7 cm short (about 5 cm below), low below that. Never bad, except below the hip
 * line (the zone's blocks check in zones.ts).
 */
export const RISE: LandingRule = {
  kind: 'landing',
  marks: [
    { label: 'low', atCm: -Infinity },
    { label: 'mid', atCm: -7 },
    { label: 'high', atCm: -2 },
  ],
};

/**
 * A pants leg opening, by opening − heel–ankle girth (cm). ASSUMED marks from
 * typical cuts (skinny under the heel girth, needing stretch; slim to +6 cm;
 * straight to +14; wide beyond). Never bad, except when it can't pass the heel
 * (the zone's blocks check in zones.ts).
 */
export const LEG_OPENING: LandingRule = {
  kind: 'landing',
  marks: [
    { label: 'skinny', atCm: -Infinity },
    { label: 'slim', atCm: 0 },
    { label: 'straight', atCm: 6 },
    { label: 'wide', atCm: 14 },
  ],
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
 * (Elastic waistbands are "high".) A garment can set stretch per measurement,
 * and a rule per zone (GirthRule.stretch).
 * compression is ASSUMED, not sourced (no leggings data yet): four-way stretch
 * meant to sit well under the body. Tune it from fit tests.
 */
export const STRETCH_ALLOWANCE: Record<Stretch, number> = {
  none: 0,
  some: 0.04,
  high: 0.2,
  compression: 0.35,
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
