/**
 * Where a top's length and sleeve are measured from, and the body target that
 * goes with each. Pure. The fit engine compares against these targets and the
 * mannequin draws from the same conversions (skin rule), so a centre-back chart
 * is scored and drawn the same way.
 *
 * Charts measure a top's length from the high point of the shoulder (HPS) or
 * from the centre of the back neck, and a sleeve from the shoulder seam or from
 * the centre back. Knits (hoodies, sweatshirts) often use the centre back,
 * because a dropped shoulder moves the seam but not the back neck.
 */

import type { BodyMeasurements, BodyType } from '../body';
import { definitionOf, type Garment, type LengthDefinition, type SizeMeasurements, type SleeveDefinition } from '../garments';
import { BACK_NECK_DROP_CM } from './rules';

type DefinitionHolder = Pick<Garment, 'lengthDefinition' | 'sleeveDefinition' | 'definitions'>;

/**
 * How far the high point of the shoulder (by the neck) sits below the top of the
 * head, as a share of stature. ASSUMED: the mannequin's own HPS, moved here so a
 * dress's hem is placed and drawn from the same number. It puts the HPS at 0.835
 * of stature above the floor, between ANSUR II's acromial (≈ 0.82) and cervicale
 * (≈ 0.86) heights; HPS itself isn't in the survey.
 */
export const HPS_BELOW_TOP_RATIO = 0.165;

/** Top of the head down to the high point of the shoulder (cm). */
export const hpsBelowTopCm = (m: Pick<BodyMeasurements, 'heightCm'>): number => HPS_BELOW_TOP_RATIO * m.heightCm;

/** Floor to the high point of the shoulder (cm). */
export const hpsHeightCm = (m: Pick<BodyMeasurements, 'heightCm'>): number => m.heightCm - hpsBelowTopCm(m);

/** The body length a top's printed length is compared with, or null when the definition can't be compared. */
export function lengthTargetCm(m: Pick<BodyMeasurements, 'torsoLengthCm'>, definition: LengthDefinition | undefined): number | null {
  if (definition === 'hps') return m.torsoLengthCm;
  // The back neck sits below the high shoulder point, so a centre-back length reads shorter by the drop.
  if (definition === 'center_back') return m.torsoLengthCm - BACK_NECK_DROP_CM;
  return null;
}

/**
 * What a tape from the centre of the back neck to the wrist measures beyond our
 * straight-line half shoulder width + arm length (cm): it follows the back and
 * the curve over the shoulder. From ANSUR II, at each survey's own statures:
 * mean sleevelengthspinewrist − mean (arm + shoulder / 2) by our ratios =
 * men 89.6 − 84.3 = 5.3 (SD 2.6), women 80.7 − 75.2 = 5.5 (SD 2.3).
 */
export const SHOULDER_CURVE_CM: Record<BodyType, number> = { mens: 5.3, womens: 5.5 };

type SleeveBody = Pick<BodyMeasurements, 'armLengthCm' | 'shoulderWidthCm' | 'bodyType'>;

/** Centre back neck to the body's shoulder point, along the back and over the shoulder (cm). */
const backToShoulderPointCm = (m: Pick<BodyMeasurements, 'shoulderWidthCm' | 'bodyType'>) =>
  m.shoulderWidthCm / 2 + SHOULDER_CURVE_CM[m.bodyType];

/** The body length a printed sleeve is compared with, or null when the definition can't be compared. */
export function sleeveTargetCm(m: SleeveBody, definition: SleeveDefinition | undefined): number | null {
  if (definition === 'shoulder_to_cuff') return m.armLengthCm;
  if (definition === 'center_back_to_cuff') return backToShoulderPointCm(m) + m.armLengthCm;
  return null;
}

/** A size's length as if measured from the high point of the shoulder (cm), or undefined when the chart can't say. */
export function hpsLengthCm(garment: DefinitionHolder, size: SizeMeasurements): number | undefined {
  if (size.length === undefined) return undefined;
  const definition = definitionOf(garment, 'length');
  if (definition === 'hps') return size.length;
  if (definition === 'center_back') return size.length + BACK_NECK_DROP_CM;
  return undefined;
}

/**
 * How far a size's sleeve reaches down the arm from the body's shoulder point (cm),
 * or undefined when the chart's sleeve can't be placed (no sleeve, or a definition
 * we don't compare). A shoulder-to-cuff sleeve is measured from the garment's own
 * seam, which the drawing places; read it from the chart directly.
 */
export function sleeveFromShoulderPointCm(
  garment: DefinitionHolder,
  size: SizeMeasurements,
  m: Pick<BodyMeasurements, 'shoulderWidthCm' | 'bodyType'>,
): number | undefined {
  if (size.sleeve === undefined) return undefined;
  return definitionOf(garment, 'sleeve') === 'center_back_to_cuff' ? size.sleeve - backToShoulderPointCm(m) : undefined;
}

/**
 * How far a long sleeve reaches down the arm from the body's shoulder point (cm),
 * or undefined for a short sleeve or one we can't place. A shoulder-to-cuff
 * sleeve starts at the garment's seam, taken here as the shoulder point.
 */
export function sleeveReachCm(
  garment: DefinitionHolder & Pick<Garment, 'sleeve'>,
  size: SizeMeasurements,
  m: Pick<BodyMeasurements, 'shoulderWidthCm' | 'bodyType'>,
): number | undefined {
  if (garment.sleeve !== 'long' || size.sleeve === undefined) return undefined;
  if (definitionOf(garment, 'sleeve') === 'shoulder_to_cuff') return size.sleeve;
  return sleeveFromShoulderPointCm(garment, size, m);
}
