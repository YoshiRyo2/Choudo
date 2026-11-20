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
import type { FitIntent, Garment, GarmentSizing, SizeMeasurements, Stretch, WaistDefinition } from '../garments';

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
  /**
   * tone "warn": reaching this mark is worth a warning (a skirt too narrow to
   * stride in). It still never makes the size good or bad; only `blocks` does.
   */
  marks: readonly { label: string; atCm: number; tone?: 'warn' }[];
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

/**
 * How much roomier a knit (hoodie, sweatshirt) is cut than a tee, chest ease in
 * cm. ASSUMED from one brand's grading, not from fit tests: Gildan's 18500
 * hoodie is 2 in wider laid flat than its 5000 tee in every size (S 20 vs 18 in),
 * so 4 in (10.2 cm) round the chest. A knit is worn over more and hangs heavier,
 * so the same "fits how you like" sits further from the body.
 * Tune with Test mode.
 */
export const KNIT_EASE_OFFSET_CM = 10;

/** A tee chest rule moved out by a template's offset. Tight is about the body, not the cut, so it stays. */
function shiftedChest(tee: GirthRule, offsetCm: number): GirthRule {
  return { ...tee, fittedMax: tee.fittedMax + offsetCm, relaxedMax: tee.relaxedMax + offsetCm, ideal: tee.ideal + offsetCm };
}
const knitChest = (tee: GirthRule): GirthRule => shiftedChest(tee, KNIT_EASE_OFFSET_CM);

/** Knit chest by the garment's sizing: the top chest rules shifted by KNIT_EASE_OFFSET_CM (ASSUMED). */
export const KNIT_GIRTH_RULES: Record<GarmentSizing, GirthRule> = {
  mens: knitChest(TOP_GIRTH_RULES.mens.chest),
  unisex: knitChest(TOP_GIRTH_RULES.unisex.chest),
  womens: knitChest(TOP_GIRTH_RULES.womens.chest),
};

/**
 * How much roomier a jacket is cut than a tee, chest ease in cm. ASSUMED from one
 * chart, not from fit tests: Port Authority's J317 soft shell measures 46 in round
 * the chest (23 in flat) in M against its size chart's 38–40 in chest, about
 * 17.8 cm of ease on M–XL, where a regular tee aims for +5 cm. Charts and these
 * bands are bare-body: the jacket is graded to go over something light, and what's
 * worn under it beyond that is added to the body (layers.ts). Tune with Test mode.
 */
export const JACKET_EASE_OFFSET_CM = 13;

/** Jacket chest by the garment's sizing: the top chest rules shifted by JACKET_EASE_OFFSET_CM (ASSUMED). */
export const JACKET_GIRTH_RULES: Record<GarmentSizing, GirthRule> = {
  mens: shiftedChest(TOP_GIRTH_RULES.mens.chest, JACKET_EASE_OFFSET_CM),
  unisex: shiftedChest(TOP_GIRTH_RULES.unisex.chest, JACKET_EASE_OFFSET_CM),
  womens: shiftedChest(TOP_GIRTH_RULES.womens.chest, JACKET_EASE_OFFSET_CM),
};

/**
 * A jacket's shoulder (seam to seam) against the body's shoulder width, cm.
 * ASSUMED: a jacket's shoulder seam should sit on the shoulder point, ±1.5 cm;
 * narrower pulls across the back (tight), up to 4 cm wider is a soft, dropped
 * shoulder (relaxed), beyond that it hangs off the shoulder (loose). No stretch.
 */
export const JACKET_SHOULDER: GirthRule = {
  kind: 'girth',
  tightBelow: -1.5,
  fittedMax: 1.5,
  relaxedMax: 4,
  ideal: 0,
  stretch: { some: 0, high: 0, compression: 0 },
};

/**
 * Where a jacket or coat's hem lands, by length − torso length (cm; 0 = the hip
 * line, where a top's length is scored to end). ASSUMED marks: cropped more than
 * 6 cm above the hip line (at the waist), hip length, thigh from 12 cm below
 * (past the crotch, about 10 cm below the hip line), knee from 32 cm (the hip line
 * is about 35–39 cm above the knee), calf from 45 cm. Descriptive only.
 */
export const JACKET_LENGTH: LandingRule = {
  kind: 'landing',
  marks: [
    { label: 'cropped', atCm: -Infinity },
    { label: 'hip', atCm: -6 },
    { label: 'thigh', atCm: 12 },
    { label: 'knee-length', atCm: 32 },
    { label: 'calf', atCm: 45 },
  ],
};

/**
 * A knit's rib hem band (relaxed) against the hips, where a top's length is
 * scored to end. ASSUMED, not sourced (no hem band charts or fit tests yet): a
 * rib is meant to gather onto the body, so "fitted" runs from snug to +4 cm and
 * "loose" (+12 cm and up) means it hangs open instead of gathering. The rib's
 * stretch (a row's `stretch.hemBand`, usually high) moves "tight" well down.
 */
export const HEM_BAND: GirthRule = {
  kind: 'girth',
  tightBelow: -2,
  fittedMax: 4,
  relaxedMax: 12,
  ideal: 0,
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

/**
 * Where a shorts hem lands, by garment inseam − the body's crotch-to-knee
 * distance (cm; 0 = the hem at the middle of the kneecap). ASSUMED marks from
 * how brands name inseams on a typical 30 cm crotch-to-knee: 5–7 in (13–18 cm)
 * reads mid-thigh, 9 in (23 cm) just above the knee, 11 in (28 cm) at the knee.
 * Descriptive only: where shorts end is a style, never a fit problem.
 */
export const SHORTS_INSEAM: LandingRule = {
  kind: 'landing',
  marks: [
    { label: 'mid-thigh', atCm: -Infinity },
    { label: 'above-knee', atCm: -12 },
    { label: 'knee', atCm: -4 },
  ],
};

/**
 * How far below the navel a skirt's waistband sits, by the chart's
 * `definitions.waist` (cm, straight down). ASSUMED, to match the pants rise
 * marks: a natural waist at the navel (where ANSUR II measures the waist; the
 * narrowest waist isn't in the survey), mid about 4 cm down (pants "mid" runs
 * 1.5–5 cm), low about 8 cm down. Unknown, or no definition, sits at the navel,
 * as pants without a rise do.
 */
export const SKIRT_BAND_DROP_CM: Record<WaistDefinition, number> = { natural: 0, mid: 4, low: 8, unknown: 0 };

/**
 * Where a skirt's hem lands, by length − the distance from the band down to the
 * middle of the kneecap (cm; 0 = the hem at the knee, positive below it). ASSUMED
 * marks: mini more than 15 cm above the knee (mid-thigh up), above the knee from
 * 15 to 5 cm, knee within 5 cm, midi from 5 cm below (mid-calf is about 20), maxi
 * from 28 cm below (the ankle on a typical 40–45 cm knee-to-ankle).
 */
export const SKIRT_LENGTH: LandingRule = {
  kind: 'landing',
  marks: [
    { label: 'mini', atCm: -Infinity },
    { label: 'above-knee', atCm: -15 },
    { label: 'knee', atCm: -5 },
    { label: 'midi', atCm: 5 },
    { label: 'maxi', atCm: 28 },
  ],
};

/**
 * The angle between the legs at the widest point of a walking stride (degrees).
 * ASSUMED from normal gait: the hip flexes about 30° at heel strike and extends
 * about 10° at toe-off, so about 40° between the thighs. A skirt's hem must go
 * round both legs that far apart (domain/fit/skirt.ts, strideGirthCm).
 */
export const STRIDE_ANGLE_DEG = 40;

/**
 * Walking room: a skirt's hem sweep − the stride girth at the hem (cm). Below 0
 * the hem can't open to a full stride: expect shorter steps (or a slit). ASSUMED;
 * a warning only, never a size problem (no slit field yet).
 */
export const WALKING_ROOM: LandingRule = {
  kind: 'landing',
  marks: [
    { label: 'restricted', atCm: -Infinity, tone: 'warn' },
    { label: 'free', atCm: 0 },
  ],
};

/**
 * How far the centre of the back neck sits below the high point of the shoulder,
 * measured down a top (cm): a chart's centre-back length reads this much shorter
 * than its HPS length. ASSUMED: a typical back-neck drop (about ¾ in) on knit and
 * tee patterns; it varies a little by garment.
 */
export const BACK_NECK_DROP_CM = 2;

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
