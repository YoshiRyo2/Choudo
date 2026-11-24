/**
 * Where a pair of pants sits on the body: the waistband's height from its rise,
 * and the body's girth at that height. Pure. The fit engine compares the waist
 * there, and the mannequin draws the band there (the same function, so the pin
 * and the picture agree). See docs/clothing-categories-design.md §2.6.
 */

import { RISE_VERTICAL_RATIO, type BodyMeasurements } from '../body';
import { definitionOf, type Garment, type SizeMeasurements } from '../garments';

/** The size's rise, when the chart says it's the front rise (the only one we can place). Else null. */
export function riseForBand(garment: Pick<Garment, 'lengthDefinition' | 'sleeveDefinition' | 'definitions'>, size: SizeMeasurements): number | null {
  return definitionOf(garment, 'rise') === 'front' && size.rise !== undefined ? size.rise : null;
}

/**
 * Height of the top of the waistband above the floor (cm). Without a rise, at the
 * navel (where ANSUR II measures the waist). With one, below the navel by
 * RISE_VERTICAL_RATIO for every cm the rise is short of the body's own front rise
 * (above it when longer). At the survey mean this is the same as crotch height +
 * 0.71 × rise; anchoring at the navel uses the body's own front rise, which grows
 * with weight, so a given rise sits lower on a fuller body.
 */
export function bandHeight(m: BodyMeasurements, garmentRiseCm: number | null): number {
  if (garmentRiseCm === null) return m.waistHeightCm;
  return m.waistHeightCm - RISE_VERTICAL_RATIO[m.bodyType] * (m.frontRiseCm - garmentRiseCm);
}

/**
 * The body's girth at a height (cm above the floor): the waist at or above the
 * navel, the hips at or below the hip line, a straight line in between. A body
 * whose hip line isn't below its navel (a sampled draw can do that) gets the waist.
 */
export function girthAtHeight(m: BodyMeasurements, heightCm: number): number {
  const span = m.waistHeightCm - m.hipHeightCm;
  if (!(span > 0) || heightCm >= m.waistHeightCm) return m.waistCm;
  if (heightCm <= m.hipHeightCm) return m.hipsCm;
  const t = (m.waistHeightCm - heightCm) / span;
  return m.waistCm + (m.hipsCm - m.waistCm) * t;
}
