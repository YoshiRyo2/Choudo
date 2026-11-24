/**
 * Where a pair of leggings ends on the leg. Pure. The fit engine places the hem
 * against the ankle bone and the mannequin draws it from the same body heights.
 */

import type { BodyMeasurements } from '../body';
import type { SizeMeasurements } from '../garments';

/**
 * Crotch to the ankle bone (cm): what a leggings inseam is set against. An inseam
 * this long ends at the ankle.
 */
export function crotchToAnkleCm(m: BodyMeasurements): number {
  return m.inseamCm - m.ankleHeightCm;
}

/** Floor to the hem (cm): the inseam below the crotch. null without an inseam. */
export function leggingsHemHeight(m: BodyMeasurements, size: SizeMeasurements): number | null {
  return size.inseam === undefined ? null : m.inseamCm - size.inseam;
}
