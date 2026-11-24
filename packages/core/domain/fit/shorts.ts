/**
 * Where a pair of shorts ends on the leg. Pure. The fit engine places the hem
 * against this distance and the mannequin draws it from the same body heights.
 */

import type { BodyMeasurements } from '../body';

/**
 * Crotch to the middle of the kneecap (cm): what a shorts inseam is set against.
 * A hem this far below the crotch ends at the knee.
 */
export function crotchToKneeCm(m: BodyMeasurements): number {
  return m.inseamCm - m.kneeHeightCm;
}
