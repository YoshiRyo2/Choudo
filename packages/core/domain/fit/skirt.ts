/**
 * Where a skirt sits on the body: the waistband's height, the chart's hip point,
 * the hem, and how wide a stride is at the hem. Pure. The fit engine compares
 * against these and the mannequin draws at the same heights (skin rule).
 * See docs/clothing-categories-design.md §6, PR 3.
 */

import type { BodyMeasurements } from '../body';
import { definitionOf, type Garment, type SizeMeasurements } from '../garments';
import { girthAtHeight } from './pants';
import { SKIRT_BAND_DROP_CM, STRIDE_ANGLE_DEG } from './rules';

export { STRIDE_ANGLE_DEG } from './rules';

type SkirtDefs = Pick<Garment, 'lengthDefinition' | 'sleeveDefinition' | 'definitions'>;

/** Height of the top of the waistband above the floor (cm): the navel, less the drop for its waist definition. */
export function skirtBandHeight(m: BodyMeasurements, garment: SkirtDefs): number {
  return m.waistHeightCm - SKIRT_BAND_DROP_CM[definitionOf(garment, 'waist') ?? 'unknown'];
}

/**
 * Height the chart measures the hips at (cm above the floor): its distance below
 * the band, when it gives one; otherwise the body's hip line (the fullest seat).
 */
export function skirtHipHeight(m: BodyMeasurements, garment: SkirtDefs & Pick<Garment, 'hipsBelowWaistCm'>): number {
  return garment.hipsBelowWaistCm === undefined ? m.hipHeightCm : skirtBandHeight(m, garment) - garment.hipsBelowWaistCm;
}

/** Height of the hem above the floor (cm): the band less the skirt's length. May be below 0 on a long skirt. */
export function skirtHemHeight(m: BodyMeasurements, garment: SkirtDefs, size: SizeMeasurements): number {
  return skirtBandHeight(m, garment) - (size.length ?? 0);
}

/**
 * One leg's girth at a height below the crotch (cm): the thigh at the crotch,
 * narrowing in a straight line to the knee girth at the knee, then the calf
 * (its fullest, so a hem below the knee never gets less room than it needs).
 */
export function legGirthAt(m: BodyMeasurements, heightCm: number): number {
  if (heightCm < m.kneeHeightCm) return m.calfCm;
  const span = m.inseamCm - m.kneeHeightCm;
  if (!(span > 0) || heightCm >= m.inseamCm) return m.thighCm;
  const t = (m.inseamCm - heightCm) / span;
  return m.thighCm + (m.kneeCm - m.thighCm) * t;
}

/**
 * The hem girth a full walking stride needs at this height (cm). Round two leg
 * sections of girth c whose centres are D apart, a band measures c + 2D. Side to
 * side the legs touch (D = c / π, the leg's width); front to back they're a
 * stride apart, 2 · d · sin(angle / 2) at d below the crotch. Above the crotch
 * there's no stride: the body's own girth there.
 */
export function strideGirthCm(m: BodyMeasurements, hemHeightCm: number): number {
  if (hemHeightCm > m.inseamCm) return girthAtHeight(m, hemHeightCm);
  const leg = legGirthAt(m, hemHeightCm);
  const below = m.inseamCm - hemHeightCm;
  const sagittal = 2 * below * Math.sin(((STRIDE_ANGLE_DEG / 2) * Math.PI) / 180);
  return leg + 2 * Math.hypot(leg / Math.PI, sagittal);
}
