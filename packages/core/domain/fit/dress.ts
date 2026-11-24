/**
 * Where a dress sits on the body: its waist seam, its hem, and how far the hem
 * is from the shoulder to the knee. Pure. The fit engine compares against these
 * and the mannequin draws at the same heights (skin rule).
 * See docs/clothing-categories-design.md §6, PR 5.
 *
 * A dress's length is printed from the high point of the shoulder (or from the
 * centre back, which tops.ts converts), so the hem hangs that far below the
 * shoulder. The length is taken straight down: a front length over a full bust
 * would hang a little shorter, which isn't modelled.
 */

import type { BodyMeasurements } from '../body';
import type { Garment, SizeMeasurements } from '../garments';
import { hpsHeightCm, hpsLengthCm } from './tops';

type DressDefs = Pick<Garment, 'lengthDefinition' | 'sleeveDefinition' | 'definitions'>;

/**
 * Height of the waist seam above the floor (cm), where the bodice meets the skirt
 * in the drawing: the navel for every seam. Whether the waist is scored there is
 * the waist zone's call (domain/fit/zones.ts): an empire or drop seam isn't.
 */
export function dressSeamHeight(m: BodyMeasurements, _garment: Pick<Garment, 'definitions'>): number {
  return m.waistHeightCm;
}

/**
 * Height of the hem above the floor (cm): the high point of the shoulder less the
 * size's length from there. May be below 0 on a long dress. Without a length we
 * can place, the shoulder itself.
 */
export function dressHemHeight(m: BodyMeasurements, garment: DressDefs, size: SizeMeasurements): number {
  return hpsHeightCm(m) - (hpsLengthCm(garment, size) ?? 0);
}

/** High point of the shoulder down to the middle of the kneecap (cm): a dress this long ends at the knee. */
export const hpsToKneeCm = (m: BodyMeasurements): number => hpsHeightCm(m) - m.kneeHeightCm;
