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

import type { BodyMeasurements } from '../body';
import { definitionOf, type Garment, type LengthDefinition, type SizeMeasurements, type SleeveDefinition } from '../garments';
import { BACK_NECK_DROP_CM } from './rules';

type DefinitionHolder = Pick<Garment, 'lengthDefinition' | 'sleeveDefinition' | 'definitions'>;

/** The body length a top's printed length is compared with, or null when the definition can't be compared. */
export function lengthTargetCm(m: Pick<BodyMeasurements, 'torsoLengthCm'>, definition: LengthDefinition | undefined): number | null {
  if (definition === 'hps') return m.torsoLengthCm;
  // The back neck sits below the high shoulder point, so a centre-back length reads shorter by the drop.
  if (definition === 'center_back') return m.torsoLengthCm - BACK_NECK_DROP_CM;
  return null;
}

/** The body length a printed sleeve is compared with, or null when the definition can't be compared. */
export function sleeveTargetCm(
  m: Pick<BodyMeasurements, 'armLengthCm' | 'shoulderWidthCm'>,
  definition: SleeveDefinition | undefined,
): number | null {
  if (definition === 'shoulder_to_cuff') return m.armLengthCm;
  // Centre back to the shoulder point is half the across-the-back shoulder width; then down the arm.
  if (definition === 'center_back_to_cuff') return m.armLengthCm + m.shoulderWidthCm / 2;
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
  m: Pick<BodyMeasurements, 'shoulderWidthCm'>,
): number | undefined {
  if (size.sleeve === undefined) return undefined;
  return definitionOf(garment, 'sleeve') === 'center_back_to_cuff' ? size.sleeve - m.shoulderWidthCm / 2 : undefined;
}
